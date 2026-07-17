import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  RegistryDocument,
  RegistryEntry,
  RejectedDocument,
  ValidationReport,
} from "../src/types.js";
import { runVerifyCli } from "../src/verify-cli.js";
import { compareRegistryDocuments, verifyRegistry } from "../src/verify-registry.js";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const temporaryRoot = path.join(testsDirectory, ".verify-tmp");

function workflow(id: string): RegistryEntry {
  return {
    id,
    name: `Fixture ${id}`,
    version: "1.0.0",
    description: "Safe fixture metadata.",
    author: "Registry Builder Tests",
    license: "MIT",
    platform: "n8n",
    minimum_platform_version: "1.50.0",
    categories: [],
    tags: [],
    inputs: [],
    outputs: [],
    permissions: {
      network_access: false,
      filesystem_read: false,
      filesystem_write: false,
      email_send: false,
      social_publish: false,
      code_execution: false,
      credential_access: false,
    },
    human_review: { required: false, checkpoints: [] },
    safety: {
      stores_user_data: false,
      sends_data_externally: false,
      contains_credentials: false,
      risk_level: "low",
    },
    testing: null,
    package_path: `packages/${id}`,
    source_file: `packages/${id}/source/workflow.json`,
    readme_file: `packages/${id}/README.md`,
    validation: {
      status: "valid",
      errors: [],
      warnings: [],
      checked_at: "2026-07-17T00:00:00.000Z",
    },
  };
}

function registry(workflows: RegistryEntry[], generatedAt = "2026-07-17T00:00:00.000Z"): RegistryDocument {
  return {
    schema_version: "0.1",
    generated_at: generatedAt,
    workflow_count: workflows.length,
    workflows,
  };
}

function rejected(generatedAt = "2026-07-17T00:00:00.000Z"): RejectedDocument {
  return {
    schema_version: "0.1",
    generated_at: generatedAt,
    rejected_count: 0,
    packages: [],
  };
}

function documents(workflows: RegistryEntry[] = [workflow("alpha-flow")]) {
  return { registry: registry(workflows), rejected: rejected() };
}

function validStub(packagePath: string): Promise<ValidationReport> {
  return Promise.resolve({
    packageRoot: packagePath,
    manifestPath: path.join(packagePath, "workflow.yaml"),
    valid: true,
    checks: [],
    issues: [],
    errorCount: 0,
    warningCount: 0,
  });
}

beforeEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
  await mkdir(temporaryRoot, { recursive: true });
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe("Registry normalization comparison", () => {
  it("passes when only generated_at and validation.checked_at differ", () => {
    const generated = documents();
    const committed = documents();
    generated.registry.generated_at = "2026-07-18T00:00:00.000Z";
    generated.rejected.generated_at = "2026-07-18T00:00:00.000Z";
    generated.registry.workflows[0]!.validation.checked_at = "2026-07-18T00:00:00.000Z";
    expect(compareRegistryDocuments(generated, committed)).toEqual([]);
  });

  it("fails when Workflow metadata differs", () => {
    const generated = documents();
    const committed = documents();
    committed.registry.workflows[0]!.name = "Outdated name";
    expect(compareRegistryDocuments(generated, committed)).toContain(
      "registry/registry.json: $.workflows[0].name (value changed)",
    );
  });

  it("fails when permissions, safety declarations, or Validation status differ", () => {
    const generated = documents();
    const committed = documents();
    committed.registry.workflows[0]!.permissions.network_access = true;
    committed.registry.workflows[0]!.safety.risk_level = "high";
    (committed.registry.workflows[0]!.validation as { status: string }).status = "outdated";
    expect(compareRegistryDocuments(generated, committed)).toEqual(expect.arrayContaining([
      "registry/registry.json: $.workflows[0].permissions.network_access (value changed)",
      "registry/registry.json: $.workflows[0].safety.risk_level (value changed)",
      "registry/registry.json: $.workflows[0].validation.status (value changed)",
    ]));
  });

  it("fails when a Workflow is missing", () => {
    const generated = documents([workflow("alpha-flow"), workflow("beta-flow")]);
    const committed = documents([workflow("alpha-flow")]);
    expect(compareRegistryDocuments(generated, committed)).toContain(
      "registry/registry.json: $.workflows.length (array length changed)",
    );
  });

  it("treats a different Workflow order as stale because Builder order is canonical", () => {
    const generated = documents([workflow("alpha-flow"), workflow("beta-flow")]);
    const committed = documents([workflow("beta-flow"), workflow("alpha-flow")]);
    expect(compareRegistryDocuments(generated, committed)).toContain(
      "registry/registry.json: $.workflows[0].id (value changed)",
    );
  });

  it("fails when rejected.json differs", () => {
    const generated = documents();
    const committed = documents();
    committed.rejected.rejected_count = 1;
    expect(compareRegistryDocuments(generated, committed)).toContain(
      "registry/rejected.json: $.rejected_count (value changed)",
    );
  });

  it("does not include changed field values in differences", () => {
    const generated = documents();
    const committed = documents();
    committed.registry.workflows[0]!.description = "token=supersecretvalue";
    const output = compareRegistryDocuments(generated, committed).join("\n");
    expect(output).not.toContain("supersecretvalue");
    expect(output).not.toContain("Safe fixture metadata");
  });
});

describe("Registry verification filesystem boundary", () => {
  it("generates in a temporary directory and never overwrites committed Registry files", async () => {
    await mkdir(path.join(temporaryRoot, "packages"), { recursive: true });
    await mkdir(path.join(temporaryRoot, "registry"), { recursive: true });
    await mkdir(path.join(temporaryRoot, "tools", "registry-builder"), { recursive: true });
    await mkdir(path.join(temporaryRoot, "website", "generated"), { recursive: true });
    const committedRegistry = `${JSON.stringify(registry([workflow("committed-only")]), null, 2)}\n`;
    const committedRejected = `${JSON.stringify(rejected(), null, 2)}\n`;
    const committedWebsiteRegistry = "website Registry must remain untouched\n";
    await writeFile(path.join(temporaryRoot, "registry", "registry.json"), committedRegistry, "utf8");
    await writeFile(path.join(temporaryRoot, "registry", "rejected.json"), committedRejected, "utf8");
    await writeFile(
      path.join(temporaryRoot, "website", "generated", "registry.json"),
      committedWebsiteRegistry,
      "utf8",
    );

    const result = await verifyRegistry({
      repositoryRoot: temporaryRoot,
      validatePackage: validStub,
      generatedAt: "2026-07-18T00:00:00.000Z",
    });

    expect(result.matches).toBe(false);
    expect(await readFile(path.join(temporaryRoot, "registry", "registry.json"), "utf8"))
      .toBe(committedRegistry);
    expect(await readFile(path.join(temporaryRoot, "registry", "rejected.json"), "utf8"))
      .toBe(committedRejected);
    expect(await readFile(
      path.join(temporaryRoot, "website", "generated", "registry.json"),
      "utf8",
    )).toBe(committedWebsiteRegistry);
    expect((await readdir(path.join(temporaryRoot, "tools", "registry-builder")))
      .some((name) => name.startsWith(".verify-registry-"))).toBe(false);
  });
});

describe("verify-registry CLI exit codes", () => {
  it("returns 0 for matching data, 1 for stale data, and 2 for a tool error", async () => {
    await mkdir(path.join(temporaryRoot, "packages"), { recursive: true });
    const common = {
      repositoryRoot: temporaryRoot,
      loadValidator: async () => validStub,
      log: () => undefined,
      error: () => undefined,
    };
    expect(await runVerifyCli({
      ...common,
      verify: async () => ({ matches: true, differences: [] }),
    })).toBe(0);
    expect(await runVerifyCli({
      ...common,
      verify: async () => ({ matches: false, differences: ["registry/registry.json: $.workflow_count (value changed)"] }),
    })).toBe(1);
    expect(await runVerifyCli({
      ...common,
      verify: () => Promise.reject(new Error("tool failure")),
    })).toBe(2);
  });
});
