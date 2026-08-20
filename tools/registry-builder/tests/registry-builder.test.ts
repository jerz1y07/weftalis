import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stringify } from "yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validatePackage as realValidatePackage } from "../../../validator/src/index.js";
import { buildRegistry } from "../src/build-registry.js";
import { runCli } from "../src/cli.js";
import { discoverPackages } from "../src/discover-packages.js";
import type {
  PackageIndependentAdmissionRecord,
  ValidatePackage,
  ValidationReport,
  WorkflowManifest,
} from "../src/types.js";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const temporaryRoot = path.join(testsDirectory, ".tmp");
const packagesRoot = path.join(temporaryRoot, "packages");
const admissionsRoot = path.join(temporaryRoot, "admissions", "package-independent");

function baseManifest(id: string): WorkflowManifest {
  return {
    spec_version: "0.1",
    id,
    name: `Fixture ${id}`,
    version: "1.0.0",
    description: "A local Registry Builder test fixture.",
    author: "Registry Builder Tests",
    license: "MIT",
    runtime: { platform: "n8n", minimum_version: "1.50.0", source_file: "source/workflow.json" },
    categories: ["testing"],
    tags: ["fixture"],
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
    human_review: { required: false, checkpoints: [] },
    safety: {
      stores_user_data: false,
      sends_data_externally: false,
      contains_credentials: false,
      risk_level: "low",
    },
    testing: { status: "passed", last_tested: "2026-07-17", tested_platform_version: "1.50.0" },
    files: { readme: "README.md" },
  };
}

async function createPackage(
  folderName: string,
  options: { manifest?: WorkflowManifest | Record<string, unknown>; sourceMarker?: string } = {},
): Promise<string> {
  const packageRoot = path.join(packagesRoot, folderName);
  await mkdir(path.join(packageRoot, "source"), { recursive: true });
  const manifest = options.manifest ?? baseManifest(folderName);
  await writeFile(path.join(packageRoot, "workflow.yaml"), stringify(manifest), "utf8");
  await writeFile(path.join(packageRoot, "README.md"), "# Local fixture\n", "utf8");
  await writeFile(
    path.join(packageRoot, "source/workflow.json"),
    JSON.stringify({
      name: folderName,
      nodes: [{ name: "Start", type: "n8n-nodes-base.manualTrigger", parameters: {} }],
      connections: {},
      marker: options.sourceMarker,
    }),
    "utf8",
  );
  return packageRoot;
}

function baseAdmissionRecord(id: string): PackageIndependentAdmissionRecord {
  return {
    record_version: "1.0",
    id,
    title: `Fixture ${id}`,
    summary: "A clearly labeled local third-party Listing fixture; it is not production provenance.",
    platform: "n8n",
    categories: ["testing"],
    tags: ["fixture"],
    original_creator: "Fixture Organization",
    creator_evidence: "Fixture evidence only; no real authorship claim is made.",
    listing_maintainer: "Registry Builder Tests",
    license_expression: "MIT",
    license_evidence: "Fixture-only MIT evidence with no production claim.",
    important_limitations: ["Not independently runtime-tested by Weft Place."],
    use_steps: ["Inspect the fixture source without executing it."],
    source: {
      source_type: "repository",
      repository_url: "https://github.com/fixture-owner/fixture-repository",
      artifact_url: "https://github.com/fixture-owner/fixture-repository/blob/0123456789abcdef0123456789abcdef01234567/workflows/fixture.json",
      acquisition_url: "https://raw.githubusercontent.com/fixture-owner/fixture-repository/0123456789abcdef0123456789abcdef01234567/workflows/fixture.json",
      artifact_path: "workflows/fixture.json",
      immutable_ref: "0123456789abcdef0123456789abcdef01234567",
      original_artifact_sha256: "a".repeat(64),
      version: null,
    },
    evidence: {
      intake_review_id: `fixture-review-${id}`,
      provenance_status: "recorded",
      source_resolution: "resolved",
      artifact_integrity: "verified",
      parsing_status: "parsed",
      structure_status: "plausible",
      license_status: "no_clear_blocker",
      secret_scan_status: "none_detected",
      malicious_content_status: "none_detected",
      transformation_status: "none",
      risk_signals: {
        credentials: "not_detected",
        code_execution: "not_detected",
        filesystem_writes: "not_detected",
        destructive_actions: "not_detected",
        external_publishing: "not_detected",
        high_risk_network: "not_detected",
        user_reports: "none",
      },
      runtime_status: "untested",
      compatibility_status: "unverified",
      evidence_references: [`test-evidence/${id}.json`],
      human_review: {
        status: "not_required",
        evidence_reference: null,
        reviewer: null,
        reviewed_at: null,
        rationale: null,
      },
    },
  };
}

async function createAdmissionRecord(
  id: string,
  change?: (record: PackageIndependentAdmissionRecord) => void,
): Promise<void> {
  const record = baseAdmissionRecord(id);
  change?.(record);
  await mkdir(admissionsRoot, { recursive: true });
  await mkdir(path.join(temporaryRoot, "test-evidence"), { recursive: true });
  await writeFile(
    path.join(temporaryRoot, "test-evidence", `${id}.json`),
    JSON.stringify({ fixture_only: true, intake_review_id: record.evidence.intake_review_id }),
    "utf8",
  );
  await writeFile(path.join(admissionsRoot, `${id}.json`), JSON.stringify(record, null, 2), "utf8");
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
  await mkdir(packagesRoot, { recursive: true });
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe("Package discovery", () => {
  it("discovers two Packages and ignores _template", async () => {
    await createPackage("alpha-flow");
    await createPackage("beta-flow");
    await createPackage("_template");
    const result = await discoverPackages(packagesRoot);
    expect(result.packages.map((item) => item.name)).toEqual(["alpha-flow", "beta-flow"]);
    expect(result.ignoredTemplates).toBe(1);
  });

  it("ignores ordinary directories without workflow.yaml", async () => {
    await mkdir(path.join(packagesRoot, "notes"));
    const result = await discoverPackages(packagesRoot);
    expect(result.packages).toEqual([]);
    expect(result.ignoredDirectories).toBe(1);
  });

  it("never includes underscore, hidden, dependency, or temporary directories", async () => {
    for (const name of ["_template", ".hidden", "node_modules", "tmp", "temp"]) {
      await createPackage(name);
    }
    const result = await discoverPackages(packagesRoot);
    expect(result.packages).toEqual([]);
  });
});

describe("Registry generation", () => {
  it("puts two valid Packages into the main Registry in stable id order", async () => {
    await createPackage("zeta-flow");
    await createPackage("alpha-flow");
    const result = await buildRegistry({
      repositoryRoot: temporaryRoot,
      validatePackage: realValidatePackage,
      generatedAt: "2026-07-17T00:00:00.000Z",
    });
    expect(result.registry.workflow_count).toBe(2);
    expect(result.registry.workflows.map((item) => item.id)).toEqual(["alpha-flow", "zeta-flow"]);
  });

  it("normalizes omitted optional fields as empty arrays and null", async () => {
    const manifest = baseManifest("optional-flow");
    delete manifest.categories;
    delete manifest.tags;
    delete manifest.testing;
    await createPackage("optional-flow", { manifest });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.registry.workflows[0]).toMatchObject({ categories: [], tags: [], testing: null });
  });

  it("Lists a clean package-independent fixture without a local Package or universal human approval", async () => {
    await createAdmissionRecord("upstream-fixture");
    const result = await buildRegistry({
      repositoryRoot: temporaryRoot,
      validatePackage: validStub,
      generatedAt: "2026-07-17T00:00:00.000Z",
    });
    expect(result.registry.workflows).toHaveLength(1);
    expect(result.registry.workflows[0]).toMatchObject({
      id: "upstream-fixture",
      package_path: null,
      listing_source: "package_independent",
      claims: {
        listed: true,
        human_reviewed: false,
        runtime_tested: false,
        compatibility_verified: false,
      },
      validation: { status: "admitted" },
    });
    expect(result.registry.workflows[0]?.listing.source).toMatchObject({
      source_type: "repository",
      artifact_path: "workflows/fixture.json",
      original_artifact_sha256: "a".repeat(64),
    });
    expect(result.rejected.listings).toEqual([]);
  });

  it("does not admit mismatched repository and artifact source coordinates", async () => {
    await createAdmissionRecord("mismatched-source-fixture", (record) => {
      if (record.source.source_type === "repository") {
        record.source.artifact_url = record.source.artifact_url.replace("fixture-owner", "different-owner");
      }
    });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.registry.workflows).toEqual([]);
    expect(result.rejected.listings[0]).toMatchObject({
      id: "mismatched-source-fixture",
      admission_state: "needs_review",
      reasons: [expect.objectContaining({ code: "admission.invalid-record" })],
    });
  });

  it("escalates a code-execution fixture to Needs Review instead of Listing it", async () => {
    await createAdmissionRecord("risky-fixture", (record) => {
      record.evidence.risk_signals.code_execution = "detected";
    });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.registry.workflows).toEqual([]);
    expect(result.rejected.listings[0]).toMatchObject({
      id: "risky-fixture",
      admission_state: "needs_review",
    });
    expect(result.rejected.listings[0]?.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "admission.risk.code_execution" }),
    ]));
  });

  it("Lists an escalated fixture only after complete human-review evidence is recorded", async () => {
    await createAdmissionRecord("reviewed-risk-fixture", (record) => {
      record.evidence.risk_signals.code_execution = "detected";
      record.evidence.human_review = {
        status: "approved",
        evidence_reference: "test-evidence/reviewed-risk-fixture.json",
        reviewer: "Fixture Reviewer",
        reviewed_at: "2026-07-17T00:00:00.000Z",
        rationale: "Fixture-only approval after inspecting the static code-execution evidence.",
      };
    });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.rejected.listings).toEqual([]);
    expect(result.registry.workflows[0]).toMatchObject({
      id: "reviewed-risk-fixture",
      claims: {
        listed: true,
        human_reviewed: true,
        runtime_tested: false,
        compatibility_verified: false,
      },
    });
  });

  it("quarantines a possible-secret fixture instead of Listing it", async () => {
    await createAdmissionRecord("secret-fixture", (record) => {
      record.evidence.secret_scan_status = "potential_values_detected";
    });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.registry.workflows).toEqual([]);
    expect(result.rejected.listings[0]).toMatchObject({
      id: "secret-fixture",
      admission_state: "quarantined",
    });
  });

  it("quarantines a potential secret in admission metadata before publication", async () => {
    await createAdmissionRecord("metadata-secret-fixture", (record) => {
      record.summary = ["api", "_key=fixturecredentialvalue"].join("");
    });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.registry.workflows).toEqual([]);
    expect(result.rejected.listings[0]).toMatchObject({
      admission_state: "quarantined",
      reasons: [expect.objectContaining({ code: "admission.record-secret" })],
    });
    expect(JSON.stringify(result.rejected)).not.toContain("fixturecredentialvalue");
  });

  it("keeps a Package Listing and escalates a competing package-independent id", async () => {
    await createPackage("shared-fixture");
    await createAdmissionRecord("shared-fixture");
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.registry.workflows.map((workflow) => workflow.id)).toEqual(["shared-fixture"]);
    expect(result.registry.workflows[0]?.listing_source).toBe("package");
    expect(result.rejected.listings[0]).toMatchObject({
      id: "shared-fixture",
      admission_state: "needs_review",
      reasons: [expect.objectContaining({ code: "admission.registry-id-conflict" })],
    });
  });

  it("represents direct-upload provenance without inventing repository fields", async () => {
    await createAdmissionRecord("upload-fixture", (record) => {
      record.source = {
        source_type: "direct_upload",
        submitter: "fixture-submitter",
        uploaded_at: "2026-07-17T00:00:00.000Z",
        original_artifact_sha256: "b".repeat(64),
        declared_author: "Fixture author claim",
        declared_license: "MIT",
        acquisition_url: null,
      };
      record.evidence.source_resolution = "not_applicable";
    });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    const source = result.registry.workflows[0]?.listing.source;
    expect(source).toMatchObject({
      source_type: "direct_upload",
      submitter: "fixture-submitter",
      original_artifact_sha256: "b".repeat(64),
    });
    expect(source).not.toHaveProperty("repository_url");
    expect(source).not.toHaveProperty("immutable_ref");
  });

  it("uses safe repository-relative POSIX paths", async () => {
    await createPackage("safe-path-flow");
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.registry.workflows[0]?.package_path).toBe("packages/safe-path-flow");
    expect(result.registry.workflows[0]?.source_file).toBe("packages/safe-path-flow/source/workflow.json");
    expect(result.registry.workflows[0]?.package_path).not.toContain("\\");
  });

  it("does not copy the complete platform source into Registry data", async () => {
    await createPackage("source-boundary", { sourceMarker: "SOURCE_CONTENT_MUST_NOT_APPEAR" });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(JSON.stringify(result.registry)).not.toContain("SOURCE_CONTENT_MUST_NOT_APPEAR");
    expect(JSON.stringify(result.registry)).not.toContain('"nodes"');
  });

  it("keeps rejected Packages out of the main Registry and records reasons", async () => {
    const invalid: Record<string, unknown> = { ...baseManifest("invalid-flow") };
    delete invalid.license;
    await createPackage("invalid-flow", { manifest: invalid });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: realValidatePackage });
    expect(result.registry.workflow_count).toBe(0);
    expect(result.rejected.rejected_count).toBe(1);
    expect(result.rejected.packages[0]?.errors.length).toBeGreaterThan(0);
  });

  it("rejects duplicate ids", async () => {
    await createPackage("first-folder", { manifest: baseManifest("shared-id") });
    await createPackage("second-folder", { manifest: baseManifest("shared-id") });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.rejected.packages).toHaveLength(2);
    expect(result.rejected.packages.every((item) => item.errors.some((issue) => issue.code === "registry.duplicate-id"))).toBe(true);
  });

  it("rejects case-insensitive id conflicts", async () => {
    await createPackage("first-case-folder", { manifest: baseManifest("research-flow") });
    await createPackage("second-case-folder", { manifest: baseManifest("Research-Flow") });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.rejected.packages.every((item) => item.errors.some((issue) => issue.code === "registry.case-conflicting-id"))).toBe(true);
  });

  it("rejects an id that does not exactly match its folder", async () => {
    await createPackage("folder-name", { manifest: baseManifest("different-id") });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.rejected.packages[0]?.errors.some((issue) => issue.code === "registry.id-folder-mismatch")).toBe(true);
  });

  it("redacts sensitive values from rejected output", async () => {
    await createPackage("redacted-flow");
    const unsafeValidator: ValidatePackage = async (packagePath) => ({
      ...(await validStub(packagePath)),
      valid: false,
      issues: [{
        severity: "error",
        code: "fixture.sensitive",
        message: "token=supersecretvalue must be removed",
        file: "workflow.yaml",
      }],
      errorCount: 1,
    });
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: unsafeValidator });
    expect(JSON.stringify(result.rejected)).not.toContain("supersecretvalue");
    expect(JSON.stringify(result.rejected)).toContain("[REDACTED]");
  });

  it("produces identical field order and content for an identical timestamp", async () => {
    await createPackage("stable-flow");
    const options = {
      repositoryRoot: temporaryRoot,
      validatePackage: validStub,
      generatedAt: "2026-07-17T00:00:00.000Z",
    };
    const first = JSON.stringify(await buildRegistry(options), null, 2);
    const second = JSON.stringify(await buildRegistry(options), null, 2);
    expect(second).toBe(first);
  });

  it("never includes the template in generated output", async () => {
    await createPackage("_template");
    const result = await buildRegistry({ repositoryRoot: temporaryRoot, validatePackage: validStub });
    expect(result.registry.workflow_count).toBe(0);
    expect(result.rejected.rejected_count).toBe(0);
  });
});

describe("CLI exit codes", () => {
  it("returns 2 when the repository root cannot be used", async () => {
    const code = await runCli({
      repositoryRoot: path.join(temporaryRoot, "missing-root"),
      loadValidator: async () => validStub,
      error: () => undefined,
    });
    expect(code).toBe(2);
  });

  it("returns 2 when the Validator cannot load", async () => {
    const code = await runCli({
      repositoryRoot: temporaryRoot,
      loadValidator: () => Promise.reject(new Error("unavailable")),
      error: () => undefined,
    });
    expect(code).toBe(2);
  });

  it("returns 1 when output cannot be written", async () => {
    const code = await runCli({
      repositoryRoot: temporaryRoot,
      loadValidator: async () => validStub,
      write: async () => { throw new Error("read-only output"); },
      log: () => undefined,
      error: () => undefined,
    });
    expect(code).toBe(1);
  });

  it("returns 0 even when a Package is rejected", async () => {
    await createPackage("rejected-flow");
    const invalidValidator: ValidatePackage = async (packagePath) => ({
      ...(await validStub(packagePath)),
      valid: false,
      issues: [{ severity: "error", code: "fixture.invalid", message: "Fix the fixture." }],
      errorCount: 1,
    });
    const code = await runCli({
      repositoryRoot: temporaryRoot,
      loadValidator: async () => invalidValidator,
      write: async () => undefined,
      log: () => undefined,
      error: () => undefined,
    });
    expect(code).toBe(0);
  });
});
