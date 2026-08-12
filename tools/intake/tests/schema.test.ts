import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createSchemaRegistry,
  IntakeValidationError,
  loadSubmissionManifest,
  schemaIds,
  validateAgainstSchema,
} from "../src/schema-validator.js";
import { fixturesDirectory } from "./helpers/github-mock.js";

describe("intake schemas and manifest parsing", () => {
  it("compiles every intake schema", async () => {
    const ajv = await createSchemaRegistry();
    for (const id of Object.values(schemaIds)) {
      expect(ajv.getSchema(id), id).toBeTypeOf("function");
    }
  });

  it("accepts JSON and YAML batch manifests", async () => {
    const json = await loadSubmissionManifest(path.join(fixturesDirectory, "manifests/valid.json"));
    const yaml = await loadSubmissionManifest(path.join(fixturesDirectory, "manifests/valid.yaml"));
    expect(json.submissions[0]?.branch).toBe("main");
    expect(yaml.submissions[0]?.tag).toBe("fixture-v1");
  });

  it("rejects more than one ref selector", async () => {
    await expect(loadSubmissionManifest(
      path.join(fixturesDirectory, "manifests/invalid-multiple-refs.json"),
    )).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("rejects unsafe repository paths and unsupported fields", async () => {
    const manifest = await loadSubmissionManifest(path.join(fixturesDirectory, "manifests/valid.json"));
    const submission = { ...manifest.submissions[0]!, artifact_path: "../outside.yml", publish: true };
    const issues = await validateAgainstSchema(schemaIds.submission, submission);
    expect(issues.some((issue) => issue.includes("unsupported field"))).toBe(true);
    expect(issues.length).toBeGreaterThan(1);
  });

  it("does not allow an automated publication flag to become true", async () => {
    const moderation = {
      record_version: "1.0",
      current_status: "needs_review",
      automatic_publication: true,
      history: [{
        status: "needs_review",
        at: "2026-07-21T00:00:00.000Z",
        actor: "intake-cli",
        reason: "Fixture",
      }],
      human_decision: null,
    };
    expect(await validateAgainstSchema(schemaIds.moderation, moderation)).not.toEqual([]);
  });
});
