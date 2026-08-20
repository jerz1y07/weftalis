import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { buildRegistry } from "../src/build-registry.js";
import { runPromoteCli } from "../src/promote-cli.js";
import {
  promoteIntake,
  PromotionError,
  previewIntakePromotion,
} from "../src/promote-intake.js";
import type { ValidationReport } from "../src/types.js";

type JsonRecord = Record<string, any>;

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturesDirectory = path.resolve(testsDirectory, "../fixtures/admission-promotion");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function readFixture(name: string): Promise<JsonRecord> {
  return JSON.parse(await readFile(path.join(fixturesDirectory, name), "utf8")) as JsonRecord;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function makeRepository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "weft-place-promotion-test-"));
  temporaryDirectories.push(root);
  await Promise.all([
    mkdir(path.join(root, "packages"), { recursive: true }),
    mkdir(path.join(root, "registry"), { recursive: true }),
    mkdir(path.join(root, "website"), { recursive: true }),
    mkdir(path.join(root, "tools", "intake"), { recursive: true }),
    mkdir(path.join(root, "admissions", "package-independent"), { recursive: true }),
    mkdir(path.join(root, "evidence"), { recursive: true }),
  ]);
  return root;
}

async function prepareRepositoryEvidence(
  root: string,
  mutateReview?: (review: JsonRecord) => void,
  mutateRequest?: (request: JsonRecord) => void,
): Promise<{ inputPath: string; outputPath: string; id: string }> {
  const review = await readFixture("repository-review-record.json");
  const request = await readFixture("repository-promotion-request.json");
  request.intake.review_record_path = "evidence/repository-review-record.json";
  request.evidence_references = [
    "evidence/repository-review-record.json",
    "evidence/repository-promotion-request.json",
  ];
  mutateReview?.(review);
  mutateRequest?.(request);
  const inputPath = path.join(root, "evidence", "repository-promotion-request.json");
  await writeJson(path.join(root, "evidence", "repository-review-record.json"), review);
  await writeJson(inputPath, request);
  return {
    inputPath,
    outputPath: path.join(root, "admissions", "package-independent", `${request.listing.id}.json`),
    id: request.listing.id,
  };
}

async function prepareDirectUploadEvidence(
  root: string,
  mutateRequest?: (request: JsonRecord) => void,
): Promise<{ inputPath: string; outputPath: string; id: string }> {
  const request = await readFixture("direct-upload-promotion-request.json");
  request.evidence_references = ["evidence/direct-upload-promotion-request.json"];
  mutateRequest?.(request);
  const inputPath = path.join(root, "evidence", "direct-upload-promotion-request.json");
  await writeJson(inputPath, request);
  return {
    inputPath,
    outputPath: path.join(root, "admissions", "package-independent", `${request.listing.id}.json`),
    id: request.listing.id,
  };
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

async function build(root: string) {
  return buildRegistry({
    repositoryRoot: root,
    validatePackage: validStub,
    generatedAt: "2026-08-20T03:00:00.000Z",
  });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("controlled Intake-to-Admission promotion", () => {
  it("promotes clean repository Intake evidence into a Package-independent Listed Registry entry", async () => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root);
    const promoted = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    expect(promoted.decision).toEqual({ state: "listed", reasons: [] });
    expect(promoted.record).toMatchObject({
      id: paths.id,
      source: {
        source_type: "repository",
        immutable_ref: "0123456789abcdef0123456789abcdef01234567",
        original_artifact_sha256: "0a35a71f3660d187c59e49941f167bbffe415c0db5c1f3c7c4407a358187cbf9",
      },
      evidence: {
        intake_created_at: "2026-08-20T01:00:00.000Z",
        artifact_retrieved_at: "2026-08-20T01:00:00.000Z",
        human_review: { status: "not_required" },
      },
    });

    const result = await build(root);
    expect(result.registry.workflows).toHaveLength(1);
    expect(result.registry.workflows[0]).toMatchObject({
      id: paths.id,
      package_path: null,
      listing_source: "package_independent",
      claims: {
        listed: true,
        static_reviewed: true,
        runtime_tested: false,
        compatibility_verified: false,
        human_reviewed: false,
      },
    });
    expect(result.rejected.listings).toEqual([]);
    expect(await exists(path.join(root, "packages", paths.id))).toBe(false);
  });

  it("maps risky repository evidence to Needs Review instead of silently Listing it", async () => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root, (review) => {
      review.static_audit.risk_summary.code_execution.status = "detected";
      review.static_audit.risk_summary.code_execution.evidence = ["Fixture Code node signal."];
      review.static_audit.signals.code_execution = [{
        category: "code execution",
        node_name: "Fixture Code",
        node_type: "n8n-nodes-base.code",
        location: "nodes[2]",
        detail: "Fixture-only static signal.",
      }];
    });
    const promoted = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    expect(promoted.decision.state).toBe("needs_review");
    expect(promoted.importantSignals).toContain("code_execution=detected");
    const result = await build(root);
    expect(result.registry.workflows).toEqual([]);
    expect(result.rejected.listings[0]).toMatchObject({
      id: paths.id,
      admission_state: "needs_review",
      reasons: [expect.objectContaining({ code: "admission.risk.code_execution" })],
    });
  });

  it.each([
    ["secret finding", (review: JsonRecord) => {
      review.static_audit.secret_scan.status = "potential_values_detected";
      review.static_audit.secret_scan.finding_count = 1;
    }, "admission.possible-secret"],
    ["integrity mismatch", (review: JsonRecord) => {
      review.resolved_artifact.fingerprint.stored_artifact_matches_fetched = false;
    }, "admission.artifact-integrity-failed"],
  ])("quarantines a repository fixture with a blocking %s", async (_label, mutate, reasonCode) => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root, mutate);
    const promoted = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    expect(promoted.decision.state).toBe("quarantined");
    const result = await build(root);
    expect(result.registry.workflows).toEqual([]);
    expect(result.rejected.listings[0]).toMatchObject({
      admission_state: "quarantined",
      reasons: expect.arrayContaining([expect.objectContaining({ code: reasonCode })]),
    });
  });

  it("preserves unavailable repository coordinates as null and produces a reviewable Quarantined record", async () => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root, (review) => {
      review.resolved_artifact.resolution_status = "failed";
      review.resolved_artifact.resolved_commit = null;
      review.resolved_artifact.artifact.verified_case_sensitive_path = null;
      review.resolved_artifact.artifact.raw_url = null;
      review.resolved_artifact.fingerprint = null;
      review.resolved_artifact.retrieved_at = null;
    });
    const promoted = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    expect(promoted.record.source).toMatchObject({
      source_type: "repository",
      artifact_url: null,
      acquisition_url: null,
      immutable_ref: null,
      original_artifact_sha256: null,
    });
    expect(promoted.decision.state).toBe("quarantined");
    const result = await build(root);
    expect(result.rejected.listings[0]?.admission_state).toBe("quarantined");
  });

  it("admits complete direct-upload provenance without repository or commit fields", async () => {
    const root = await makeRepository();
    const paths = await prepareDirectUploadEvidence(root);
    const promoted = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    expect(promoted.decision.state).toBe("listed");
    expect(promoted.record.source).toMatchObject({
      source_type: "direct_upload",
      submitter: "fixture-direct-submitter",
      uploaded_at: "2026-08-20T01:55:00.000Z",
      declared_author: "Fixture Direct Author",
      declared_license: "MIT",
    });
    expect(promoted.record.source).not.toHaveProperty("repository_url");
    expect(promoted.record.source).not.toHaveProperty("immutable_ref");
    const result = await build(root);
    expect(result.registry.workflows[0]?.id).toBe(paths.id);
  });

  it("preserves incomplete direct-upload declarations and prevents ordinary auto-Listing", async () => {
    const root = await makeRepository();
    const paths = await prepareDirectUploadEvidence(root, (request) => {
      request.intake.declared_author = null;
      request.intake.declared_license = null;
      request.intake.human_review = {
        status: "approved",
        reviewer: "Fixture Reviewer",
        reviewed_at: "2026-08-20T02:30:00.000Z",
        rationale: "Fixture approval cannot supply missing provenance fields.",
      };
    });
    const promoted = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    expect(promoted.record.source).toMatchObject({ declared_author: null, declared_license: null });
    expect(promoted.decision.state).toBe("needs_review");
    expect(promoted.record.evidence.human_review.status).toBe("approved");
    expect(promoted.missingEvidence).toEqual(expect.arrayContaining([
      "direct-upload declared author",
      "direct-upload declared license",
    ]));
    const result = await build(root);
    expect(result.registry.workflows).toEqual([]);
    expect(result.rejected.listings[0]?.admission_state).toBe("needs_review");
  });

  it("quarantines a direct upload when the original artifact hash is absent", async () => {
    const root = await makeRepository();
    const paths = await prepareDirectUploadEvidence(root, (request) => {
      request.intake.original_artifact_sha256 = null;
      request.intake.artifact_integrity = "failed";
    });
    const promoted = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    expect(promoted.decision.state).toBe("quarantined");
    const result = await build(root);
    expect(result.rejected.listings[0]?.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "admission.direct-upload-artifact-hash-missing" }),
    ]));
  });

  it("produces identical bytes and reuses the same identity on repeated promotion", async () => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root);
    const first = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    const firstBytes = await readFile(paths.outputPath, "utf8");
    const second = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    const secondBytes = await readFile(paths.outputPath, "utf8");
    expect(second.json).toBe(first.json);
    expect(secondBytes).toBe(firstBytes);
    expect(second.reusedExisting).toBe(true);
    expect(second.wrote).toBe(false);
  });

  it("previews an unavailable stable evidence reference as Needs Review, matching Registry Builder", async () => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root, undefined, (request) => {
      request.evidence_references = ["evidence/missing-stable-reference.json"];
    });
    const promoted = await promoteIntake({ repositoryRoot: root, ...paths, write: true });
    expect(promoted.decision.state).toBe("needs_review");
    expect(promoted.missingEvidence).toContain("available stable evidence references");
    const result = await build(root);
    expect(result.rejected.listings[0]?.reasons).toEqual([
      expect.objectContaining({ code: "admission.evidence-reference-unavailable" }),
    ]);
  });

  it("keeps transformed artifact identity separate from immutable upstream identity", async () => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root, undefined, (request) => {
      request.assessment.transformation = {
        status: "substantial",
        evidence: "Fixture-only substantial transformation assessment.",
        transformed_artifact: {
          sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          owner: "Fixture Adapter Owner",
          license: "Apache-2.0",
        },
      };
    });
    const promoted = await previewIntakePromotion({ repositoryRoot: root, ...paths });
    expect(promoted.record.source.original_artifact_sha256)
      .toBe("0a35a71f3660d187c59e49941f167bbffe415c0db5c1f3c7c4407a358187cbf9");
    expect(promoted.record.evidence.transformed_artifact).toEqual({
      sha256: "c".repeat(64),
      owner: "Fixture Adapter Owner",
      license: "Apache-2.0",
    });
    expect(promoted.decision.state).toBe("needs_review");
  });

  it("preserves human-review evidence but does not let approval override a quarantine blocker", async () => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root, (review) => {
      review.moderation.current_status = "approved";
      review.moderation.human_decision = {
        reviewer: "Fixture Reviewer",
        reviewed_at: "2026-08-20T02:30:00.000Z",
        rationale: "Fixture-only review rationale.",
      };
      review.static_audit.secret_scan.status = "potential_values_detected";
      review.static_audit.secret_scan.finding_count = 1;
    });
    const promoted = await previewIntakePromotion({ repositoryRoot: root, ...paths });
    expect(promoted.record.evidence.human_review).toMatchObject({
      status: "approved",
      reviewer: "Fixture Reviewer",
      reviewed_at: "2026-08-20T02:30:00.000Z",
    });
    expect(promoted.decision.state).toBe("quarantined");
  });

  it("defaults the CLI to preview and leaves Intake, Packages, Registry, and website unchanged", async () => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root);
    const sentinels = [
      path.join(root, "tools", "intake", "sentinel.txt"),
      path.join(root, "packages", "sentinel.txt"),
      path.join(root, "registry", "sentinel.txt"),
      path.join(root, "website", "sentinel.txt"),
    ];
    await Promise.all(sentinels.map((filePath) => writeFile(filePath, "unchanged\n", "utf8")));
    const logs: string[] = [];
    const code = await runPromoteCli([
      paths.inputPath,
      "--output",
      paths.outputPath,
    ], {
      repositoryRoot: root,
      cwd: root,
      log: (message) => logs.push(message),
      error: (message) => logs.push(message),
    });
    expect(code).toBe(0);
    expect(await exists(paths.outputPath)).toBe(false);
    expect(await Promise.all(sentinels.map((filePath) => readFile(filePath, "utf8"))))
      .toEqual(sentinels.map(() => "unchanged\n"));
    expect(logs.join("\n")).toContain("Proposed admission state: Listed");
    expect(logs.join("\n")).toContain("Preview only; no file was written.");
  });

  it("refuses divergent output collisions and protected output paths", async () => {
    const root = await makeRepository();
    const paths = await prepareRepositoryEvidence(root);
    await writeFile(paths.outputPath, "different bytes\n", "utf8");
    await expect(promoteIntake({ repositoryRoot: root, ...paths, write: true }))
      .rejects.toThrow(/collision/);
    await expect(previewIntakePromotion({
      repositoryRoot: root,
      inputPath: paths.inputPath,
      outputPath: path.join(root, "registry", `${paths.id}.json`),
    })).rejects.toBeInstanceOf(PromotionError);
  });
});
