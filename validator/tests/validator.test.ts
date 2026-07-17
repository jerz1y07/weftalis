import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validatePackage } from "../src/index.js";
import { validateSchema } from "../src/schema-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(testDirectory, "../fixtures");
const schemaPath = path.resolve(testDirectory, "../../spec/workflow.schema.json");

function fixture(name: string): string {
  return path.join(fixtures, name);
}

function schemaTestManifest() {
  return {
    spec_version: "0.1",
    id: "draft-check",
    name: "Draft check",
    version: "1.0.0",
    description: "Checks Draft 2020-12 Schema rules.",
    author: "Tests",
    license: "MIT",
    runtime: { platform: "n8n", minimum_version: "1.0.0", source_file: "workflow.json" },
    inputs: [],
    outputs: [],
    dependencies: { services: [], models: [], tools: [] },
    permissions: {
      network_access: false,
      filesystem_read: false,
      filesystem_write: false,
      email_send: false,
      social_publish: false,
      code_execution: false,
      credential_access: false,
    },
    human_review: { required: false, checkpoints: [] as string[] },
    safety: {
      stores_user_data: false,
      sends_data_externally: false,
      contains_credentials: false,
      risk_level: "low",
    },
    files: { readme: "README.md" },
  };
}

describe("Workflow Package Validator", () => {
  it("accepts the valid n8n Package", async () => {
    const report = await validatePackage(fixture("valid-n8n-package"));
    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it("accepts the valid Dify Package with human review", async () => {
    const report = await validatePackage(fixture("valid-dify-package"));
    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it("accepts a direct path to workflow.yaml", async () => {
    const report = await validatePackage(
      path.join(fixture("valid-n8n-package"), "workflow.yaml"),
    );
    expect(report.valid).toBe(true);
  });

  it("rejects malformed YAML without an internal crash", async () => {
    const report = await validatePackage(fixture("invalid-yaml"));
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === "manifest.invalid-yaml")).toBe(true);
  });

  it("requires at least one checkpoint when human review is required", async () => {
    const invalidHumanReview = schemaTestManifest();
    invalidHumanReview.human_review = { required: true, checkpoints: [] };
    const issues = await validateSchema(invalidHumanReview, schemaPath);
    expect(issues.some((issue) => issue.code === "schema.minItems")).toBe(true);
  });

  it("requires empty checkpoints when human review is not required", async () => {
    const invalidHumanReview = schemaTestManifest();
    invalidHumanReview.human_review.checkpoints = ["Unexpected approval"];
    const issues = await validateSchema(invalidHumanReview, schemaPath);
    expect(issues.some((issue) => issue.code === "schema.maxItems")).toBe(true);
  });

  it("rejects duplicate human-review checkpoints", async () => {
    const invalidHumanReview = schemaTestManifest();
    invalidHumanReview.human_review = {
      required: true,
      checkpoints: ["Approve output", "Approve output"],
    };
    const issues = await validateSchema(invalidHumanReview, schemaPath);
    expect(issues.some((issue) => issue.code === "schema.uniqueItems")).toBe(true);
  });

  it("keeps format validation enabled", async () => {
    const invalidDate = schemaTestManifest();
    const value = { ...invalidDate, testing: { status: "passed", last_tested: "2026-99-99" } };
    const issues = await validateSchema(value, schemaPath);
    expect(issues.some((issue) => issue.code === "schema.format")).toBe(true);
  });

  it("rejects a missing license through Schema validation", async () => {
    const report = await validatePackage(fixture("invalid-missing-license"));
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.message.includes('"license"'))).toBe(true);
  });

  it("rejects a detected email capability declared false", async () => {
    const report = await validatePackage(fixture("invalid-email-permission"));
    expect(report.valid).toBe(false);
    expect(
      report.issues.some(
        (issue) =>
          issue.code === "permission.undeclared-capability" &&
          issue.message.includes("email_send"),
      ),
    ).toBe(true);
  });

  it("rejects a traversal path", async () => {
    const report = await validatePackage(fixture("invalid-path-traversal"));
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === "schema.pattern")).toBe(true);
  });

  it("rejects missing referenced files with clear field names", async () => {
    const report = await validatePackage(fixture("invalid-missing-file"));
    expect(report.valid).toBe(false);
    expect(
      report.issues.some((issue) => issue.message.includes("runtime.source_file")),
    ).toBe(true);
    expect(report.issues.some((issue) => issue.message.includes("files.readme"))).toBe(true);
  });

  it("detects the fake secret and never returns its full value", async () => {
    const fakeSecret = "sk-FAKEONLYFORVALIDATOR1234567890XY";
    const report = await validatePackage(fixture("invalid-secret"));
    expect(report.valid).toBe(false);
    const serialized = JSON.stringify(report);
    expect(report.issues.some((issue) => issue.code === "secret.detected")).toBe(true);
    expect(serialized).not.toContain(fakeSecret);
    expect(serialized).toContain("sk-…XY");
  });

  it("warns for an unknown node without failing", async () => {
    const report = await validatePackage(fixture("warning-unknown-node"));
    expect(report.valid).toBe(true);
    expect(report.warningCount).toBeGreaterThan(0);
    expect(report.issues.some((issue) => issue.code === "adapter.unknown-node")).toBe(true);
  });
});
