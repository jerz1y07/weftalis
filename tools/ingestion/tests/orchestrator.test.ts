import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../src/cli.js";
import {
  createMemoizedGitHubFetch,
  derivePromotionRequest,
  runBatch,
  type BatchSummary,
  type DiscoveryCandidate,
  type OrchestratorDependencies,
  type Submission,
  type SubmissionManifest,
} from "../src/orchestrator.js";

const temporaryDirectories: string[] = [];
const fixedTime = "2026-08-20T09:21:01.740Z";
const sensitiveFixtureValue = ["fixture", "sensitive", "value"].join("-");

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function makeRepository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "weft-place-ingestion-test-"));
  temporaryDirectories.push(root);
  await Promise.all([
    mkdir(path.join(root, "packages", "fixture-package"), { recursive: true }),
    mkdir(path.join(root, "admissions", "package-independent"), { recursive: true }),
    mkdir(path.join(root, "registry"), { recursive: true }),
    mkdir(path.join(root, "website"), { recursive: true }),
  ]);
  await writeFile(path.join(root, "packages", "fixture-package", "sentinel.txt"), "package\n", "utf8");
  await writeFile(path.join(root, "registry", "registry.json"), "registry\n", "utf8");
  await writeFile(path.join(root, "website", "sentinel.txt"), "website\n", "utf8");
  return root;
}

function submission(id: string, title = id): Submission {
  return {
    record_version: "1.0",
    submission_id: id,
    repository_url: "https://github.com/fixture-owner/fixture-repository",
    artifact_path: `workflows/${id}.json`,
    commit: "0123456789abcdef0123456789abcdef01234567",
    platform_hint: "n8n",
    workflow_name: title,
    description: `Deterministic fixture for ${id}.`,
    submitter: { name_or_handle: "Weft Place Discovery", claims_authorship: false },
  };
}

function discovery(item: Submission, index: number): DiscoveryCandidate {
  const id = item.submission_id!;
  const encoded = item.artifact_path.split("/").map(encodeURIComponent).join("/");
  return {
    record_version: "1.0",
    candidate_id: id,
    dedupe_identity: `github:fixture-owner/fixture-repository@${item.commit}:${item.artifact_path}`,
    source_type: "repository",
    platform: "n8n",
    title: item.workflow_name,
    repository: {
      url: item.repository_url,
      owner: "fixture-owner",
      name: "fixture-repository",
      visibility: "public",
      archived: false,
    },
    repository_owner_evidence: {
      value: "fixture-owner",
      basis: "repository_owner",
      limitation: "Repository ownership is not artifact authorship.",
    },
    immutable_ref: { kind: "commit", commit: item.commit!, default_branch: "main" },
    artifact: {
      path: item.artifact_path,
      format: "n8n_json",
      blob_url: `${item.repository_url}/blob/${item.commit}/${encoded}`,
      raw_url: `https://raw.githubusercontent.com/fixture-owner/fixture-repository/${item.commit}/${encoded}`,
      git_blob_sha: String(index + 1).repeat(40).slice(0, 40),
      byte_size: 100 + index,
    },
    license_evidence: {
      status: "found",
      spdx_id: "MIT",
      name: "MIT License",
      path: "LICENSE",
      evidence_url: `${item.repository_url}/blob/${item.commit}/LICENSE`,
      scope: "repository-level",
      limitation: "Repository-level license evidence may not apply to this artifact.",
    },
    discovery_sources: [{ source_id: "fixture", adapter: "fixture" }],
    discovered_at: fixedTime,
    provenance: [
      { kind: "repository", url: item.repository_url },
      { kind: "artifact", url: `${item.repository_url}/blob/${item.commit}/${encoded}` },
    ],
    warnings: [],
  };
}

async function createDiscoveryRun(root: string, items: Submission[]): Promise<string> {
  const run = path.join(root, "discovery-fixture");
  await mkdir(run);
  const manifest: SubmissionManifest = { manifest_version: "1.0", submissions: items };
  await writeFile(path.join(run, "intake-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(run, "candidates.jsonl"),
    `${items.map((item, index) => JSON.stringify(discovery(item, index))).join("\n")}\n`,
    "utf8",
  );
  await writeFile(path.join(run, "report.json"), `${JSON.stringify({ discovered_at: fixedTime })}\n`, "utf8");
  return run;
}

function reviewRecord(item: Submission): Record<string, any> {
  return {
    record_version: "1.0",
    review_id: `review-${item.submission_id}`,
    created_at: fixedTime,
    original_submission: item,
    resolved_artifact: {
      resolution_status: "resolved",
      repository: {
        submitted_url: item.repository_url,
        normalized_url: item.repository_url,
        owner: "fixture-owner",
        name: "fixture-repository",
      },
      requested_ref: { kind: "commit", value: item.commit, was_mutable: false },
      resolved_commit: item.commit,
      artifact: {
        requested_path: item.artifact_path,
        verified_case_sensitive_path: item.artifact_path,
        raw_url: `https://raw.githubusercontent.com/fixture-owner/fixture-repository/${item.commit}/${item.artifact_path}`,
      },
      fingerprint: {
        sha256: sha(item.artifact_path),
        git_blob_sha_matches: true,
        stored_artifact_matches_fetched: true,
      },
      retrieved_at: fixedTime,
      license_evidence: {
        submission_claim: null,
        repository_level: { status: "found", spdx_id: "MIT" },
        file_level: { status: "missing", spdx_identifiers: [] },
      },
    },
    static_audit: {
      platform: "n8n",
      parsing_status: "parsed",
      secret_scan: { status: "none_detected", finding_count: 0 },
      runtime_status: "untested",
      compatibility_status: "unverified",
    },
    duplicate_status: {
      duplicate_artifact: false,
      artifact_matches: [],
      duplicate_source: false,
      source_matches: [],
    },
    moderation: { current_status: "needs_review", human_decision: null },
  };
}

function dependencies(calls: { intake: string[] }, delay = false): OrchestratorDependencies {
  return {
    loadSubmissionManifest: async (manifestPath) => (
      JSON.parse(await readFile(manifestPath, "utf8")) as SubmissionManifest
    ),
    runIntake: async (options) => {
      const manifest = JSON.parse(await readFile(String(options.manifestPath), "utf8")) as SubmissionManifest;
      const item = manifest.submissions[0]!;
      calls.intake.push(item.submission_id!);
      if (delay) {
        const milliseconds = Number(item.submission_id!.slice(-1)) % 3 * 5;
        await new Promise((resolve) => setTimeout(resolve, milliseconds));
      }
      if (item.workflow_name === "Fail") {
        throw new Error(`token=${process.env.GITHUB_TOKEN ?? sensitiveFixtureValue} source failure`);
      }
      const record = reviewRecord(item);
      const reviewDirectory = path.join(String(options.outputRoot), "reviews", String(record.review_id));
      await mkdir(reviewDirectory, { recursive: true });
      await writeFile(path.join(reviewDirectory, "review-record.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
      return {
        processed: [{ record, reviewDirectory, reusedExisting: false }],
        failedCount: 0,
      };
    },
    promoteIntake: async (options) => {
      const request = JSON.parse(await readFile(String(options.inputPath), "utf8")) as Record<string, any>;
      const id = request.listing.id as string;
      const decision = id.includes("quarantine") ? "quarantined"
        : id.includes("review") ? "needs_review"
          : "listed";
      const reviewPath = path.resolve(String(options.repositoryRoot), request.intake.review_record_path);
      const review = JSON.parse(await readFile(reviewPath, "utf8")) as Record<string, any>;
      const record = {
        id,
        source: {
          source_type: "repository",
          repository_url: review.resolved_artifact.repository.normalized_url,
          immutable_ref: review.resolved_artifact.resolved_commit,
          artifact_path: review.resolved_artifact.artifact.requested_path,
          original_artifact_sha256: review.resolved_artifact.fingerprint?.sha256 ?? null,
        },
        evidence: {
          provenance_status: "recorded",
          evidence_references: request.evidence_references,
        },
      };
      if (options.write) {
        await writeFile(String(options.outputPath), `${JSON.stringify(record, null, 2)}\n`, "utf8");
      }
      return {
        record,
        decision: { state: decision, reasons: [] },
        wrote: Boolean(options.write),
        reusedExisting: false,
      };
    },
    buildRegistry: async (options) => {
      const names = (await readdir(String(options.admissionsRoot))).filter((name) => name.endsWith(".json"));
      return {
        registry: {
          workflow_count: names.length + 1,
          workflows: [
            { listing_source: "package" },
            ...names.map(() => ({ listing_source: "package_independent" })),
          ],
        },
        rejected: { rejected_count: 0, packages: [], listings: [] },
        discoveredCount: 1,
        discoveredListingCount: names.length,
      };
    },
    writeRegistryOutput: async (outputRoot, registry, rejected) => {
      await mkdir(path.join(outputRoot, "registry"), { recursive: true });
      await writeFile(path.join(outputRoot, "registry", "registry.json"), JSON.stringify(registry), "utf8");
      await writeFile(path.join(outputRoot, "registry", "rejected.json"), JSON.stringify(rejected), "utf8");
    },
    validatePackage: async () => ({}),
  };
}

describe("batch Intake orchestration", () => {
  it("deduplicates concurrent identical GitHub API reads in memory without caching failures", async () => {
    let calls = 0;
    const fetcher = createMemoizedGitHubFetch(async () => {
      calls += 1;
      return Response.json({ fixture: true });
    });
    const url = "https://api.github.com/repos/fixture-owner/fixture-repository";
    const responses = await Promise.all([fetcher(url), fetcher(url), fetcher(url)]);

    expect(calls).toBe(1);
    await expect(Promise.all(responses.map((response) => response.json()))).resolves.toEqual([
      { fixture: true },
      { fixture: true },
      { fixture: true },
    ]);

    let failures = 0;
    const failing = createMemoizedGitHubFetch(async () => {
      failures += 1;
      return Response.json({ message: "rate limited" }, { status: 403 });
    });
    await failing(url);
    await failing(url);
    expect(failures).toBe(2);
  });

  it("hands deterministic fixture evidence through the real Intake and Admission Promoter without live GitHub", async () => {
    const root = await makeRepository();
    const item: Submission = {
      ...submission("disc-real-handoff", "Fixture Dify Workflow"),
      artifact_path: "workflows/valid-dify.yml",
      platform_hint: "dify",
    };
    const input = await createDiscoveryRun(root, [item]);
    const intakeModulePath = new URL("../../intake/src/intake.ts", import.meta.url).href;
    const githubModulePath = new URL("../../intake/src/github.ts", import.meta.url).href;
    const mockModulePath = new URL("../../intake/tests/helpers/github-mock.ts", import.meta.url).href;
    const promoterModulePath = new URL("../../registry-builder/src/promote-intake.ts", import.meta.url).href;
    const [intakeModule, githubModule, mockModule, promoterModule] = await Promise.all([
      import(intakeModulePath),
      import(githubModulePath),
      import(mockModulePath),
      import(promoterModulePath),
    ]);
    const github = new githubModule.GitHubClient({ fetch: await mockModule.createGitHubMock() });
    const stub = dependencies({ intake: [] });
    const summary = await runBatch({
      repositoryRoot: root,
      inputPath: input,
      write: true,
      runId: "real-handoff",
      registryPreview: false,
      dependencies: {
        ...stub,
        runIntake: (options) => intakeModule.runIntake({ ...options, github }) as any,
        promoteIntake: (options) => promoterModule.promoteIntake(options) as any,
      },
    });

    expect(summary.intake_completed).toBe(1);
    expect(summary.candidates[0]?.error).toBeNull();
    expect(summary.admission_promotion_completed).toBe(1);
    expect(summary.immutable_reference_preserved).toBe(1);
    expect(summary.protected_directory_writes).toBe(0);
    const admission = JSON.parse(await readFile(
      path.join(root, "ingestion-workspace", "real-handoff", "candidates", item.submission_id!, "admission", `${item.submission_id}.json`),
      "utf8",
    )) as Record<string, any>;
    expect(admission).toMatchObject({
      id: item.submission_id,
      original_creator: null,
      source: {
        source_type: "repository",
        immutable_ref: item.commit,
        artifact_path: item.artifact_path,
      },
      evidence: {
        provenance_status: "recorded",
        malicious_content_status: "not_assessed",
        runtime_status: "untested",
        compatibility_status: "unverified",
      },
    });
  });

  it("processes multiple candidates, records one failure, preserves provenance, and never writes protected directories", async () => {
    const root = await makeRepository();
    const items = [submission("disc-03"), submission("disc-01"), submission("disc-02", "Fail")];
    const input = await createDiscoveryRun(root, items);
    const calls = { intake: [] as string[] };
    const previousToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = sensitiveFixtureValue;
    try {
      const summary = await runBatch({
        repositoryRoot: root,
        inputPath: input,
        write: true,
        runId: "fixture-run",
        concurrency: 3,
        dependencies: dependencies(calls, true),
      });

      expect(summary.candidates_attempted).toBe(3);
      expect(summary.operational_states).toMatchObject({ completed: 2, failed: 1 });
      expect(summary.admission_promotion_completed).toBe(2);
      expect(summary.protected_directory_writes).toBe(0);
      expect(summary.imported_workflow_executions).toBe(0);
      expect(summary.candidates.map((item) => item.candidate_id)).toEqual(["disc-01", "disc-02", "disc-03"]);
      expect(JSON.stringify(summary)).not.toContain(sensitiveFixtureValue);
      expect(summary.candidates.find((item) => item.candidate_id === "disc-02")?.error).toContain("[REDACTED]");

      const candidate = JSON.parse(await readFile(
        path.join(root, "ingestion-workspace", "fixture-run", "candidates", "disc-01", "candidate.json"),
        "utf8",
      )) as Record<string, any>;
      expect(candidate.discovery_candidate).toMatchObject({
        candidate_id: "disc-01",
        immutable_ref: { commit: items[1]!.commit },
        repository_owner_evidence: { limitation: "Repository ownership is not artifact authorship." },
        license_evidence: { scope: "repository-level" },
      });
      const request = JSON.parse(await readFile(
        path.join(root, "ingestion-workspace", "fixture-run", "candidates", "disc-01", "promotion-request.json"),
        "utf8",
      )) as Record<string, any>;
      expect(request.listing).toMatchObject({ categories: [], tags: [] });
      expect(request.assessment).toMatchObject({ malicious_content_status: "not_assessed", user_reports: "unknown" });
      expect(request.evidence_references).toEqual(expect.arrayContaining([
        expect.stringContaining("candidate.json"),
        expect.stringContaining("review-record.json"),
        items[1]!.repository_url,
      ]));
      expect(await readFile(path.join(root, "packages", "fixture-package", "sentinel.txt"), "utf8")).toBe("package\n");
      expect(await readFile(path.join(root, "registry", "registry.json"), "utf8")).toBe("registry\n");
      expect(await readFile(path.join(root, "website", "sentinel.txt"), "utf8")).toBe("website\n");
    } finally {
      if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previousToken;
    }
  });

  it("resumes a bounded pilot, skips completed work, and makes a completed rerun idempotent", async () => {
    const root = await makeRepository();
    const items = [submission("disc-01"), submission("disc-02"), submission("disc-03")];
    const input = await createDiscoveryRun(root, items);
    const calls = { intake: [] as string[] };
    const deps = dependencies(calls);
    await runBatch({
      repositoryRoot: root,
      inputPath: input,
      write: true,
      limit: 2,
      runId: "resume-run",
      dependencies: deps,
    });
    expect(calls.intake).toHaveLength(2);
    const admissionPath = path.join(
      root,
      "ingestion-workspace",
      "resume-run",
      "candidates",
      "disc-01",
      "admission",
      "disc-01.json",
    );
    const firstBytes = await readFile(admissionPath, "utf8");

    const resumed = await runBatch({
      repositoryRoot: root,
      inputPath: input,
      write: true,
      resume: true,
      runId: "resume-run",
      dependencies: deps,
    });
    expect(calls.intake).toHaveLength(3);
    expect(resumed.candidates_skipped_completed).toBe(2);
    expect(resumed.resumability_exercised).toBe(true);
    expect(resumed.operational_states.completed).toBe(3);

    const rerun = await runBatch({
      repositoryRoot: root,
      inputPath: input,
      write: true,
      resume: true,
      runId: "resume-run",
      dependencies: deps,
    });
    expect(calls.intake).toHaveLength(3);
    expect(rerun.candidates_attempted).toBe(0);
    expect(await readFile(admissionPath, "utf8")).toBe(firstBytes);
  });

  it("retries a promoted retrieval failure without overwriting the earlier staged evidence", async () => {
    const root = await makeRepository();
    const item = submission("disc-transient");
    const input = await createDiscoveryRun(root, [item]);
    const calls = { intake: [] as string[] };
    const deps = dependencies(calls);
    const successfulIntake = deps.runIntake;
    let first = true;
    deps.runIntake = async (options) => {
      if (!first) return successfulIntake(options);
      first = false;
      calls.intake.push(item.submission_id!);
      const record = reviewRecord(item);
      record.resolved_artifact.resolution_status = "failed";
      record.resolved_artifact.resolved_commit = null;
      record.resolved_artifact.fingerprint = null;
      record.resolved_artifact.failure = { code: "github.rate_limited", message: "Public API limit reached." };
      record.static_audit.parsing_status = "needs_review";
      const reviewDirectory = path.join(String(options.outputRoot), "reviews", String(record.review_id));
      await mkdir(reviewDirectory, { recursive: true });
      await writeFile(path.join(reviewDirectory, "review-record.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
      return { processed: [{ record, reviewDirectory, reusedExisting: false }], failedCount: 1 };
    };

    const initial = await runBatch({
      repositoryRoot: root,
      inputPath: input,
      write: true,
      runId: "transient-run",
      dependencies: deps,
    });
    expect(initial.operational_states.failed).toBe(1);
    const firstAdmission = path.join(
      root,
      "ingestion-workspace",
      "transient-run",
      "candidates",
      item.submission_id!,
      "admission",
      `${item.submission_id}.json`,
    );
    const failedBytes = await readFile(firstAdmission, "utf8");

    const resumed = await runBatch({
      repositoryRoot: root,
      inputPath: input,
      write: true,
      resume: true,
      runId: "transient-run",
      dependencies: deps,
    });
    expect(resumed.operational_states.completed).toBe(1);
    expect(resumed.retries).toBe(1);
    expect(resumed.resumability_exercised).toBe(true);
    expect(resumed.collisions).toBe(0);
    expect(resumed.registry_preview?.output_directory).toContain("registry-preview-attempts/attempt-2");
    expect(resumed.candidates[0]?.promotion.record_path).toContain("admission-attempts/attempt-2");
    expect(await readFile(firstAdmission, "utf8")).toBe(failedBytes);
  });

  it("keeps deterministic candidate and promotion identity across concurrency levels", async () => {
    const root = await makeRepository();
    const items = [submission("disc-03"), submission("disc-01"), submission("disc-02")];
    const input = await createDiscoveryRun(root, items);
    const sequential = await runBatch({
      repositoryRoot: root,
      inputPath: input,
      write: false,
      concurrency: 1,
      dependencies: dependencies({ intake: [] }, true),
    });
    const concurrent = await runBatch({
      repositoryRoot: root,
      inputPath: input,
      write: false,
      concurrency: 3,
      dependencies: dependencies({ intake: [] }, true),
    });
    const projection = (summary: BatchSummary) => summary.candidates.map((item) => ({
      candidate_id: item.candidate_id,
      identity: item.identity,
      listing_id: item.promotion.listing_id,
      admission_state: item.promotion.admission_state,
    }));
    expect(projection(concurrent)).toEqual(projection(sequential));
    expect(concurrent.candidates.map((item) => item.candidate_id)).toEqual(["disc-01", "disc-02", "disc-03"]);
  });

  it("keeps missing optional Discovery fields unknown in deterministic promotion input", () => {
    const item = submission("disc-unknown");
    const review = reviewRecord(item);
    review.resolved_artifact.license_evidence.repository_level = { status: "missing", spdx_id: null };
    review.resolved_artifact.license_evidence.file_level = { status: "missing", spdx_identifiers: [] };
    const request = derivePromotionRequest({
      candidate: {
        id: "disc-unknown",
        identity: `fixture:${item.artifact_path}`,
        submission: item,
        discovery: null,
        evidenceTime: fixedTime,
      } as any,
      review,
      reviewReference: "evidence/review.json",
      candidateReference: "evidence/candidate.json",
    }) as Record<string, any>;

    expect(request.listing).toMatchObject({ categories: [], tags: [] });
    expect(request.assessment).toMatchObject({
      license_status: "unclear",
      malicious_content_status: "not_assessed",
      user_reports: "unknown",
    });
    expect(JSON.stringify(request)).not.toContain("original_creator");
  });

  it("returns zero for individual candidate failures and nonzero only for a systemic CLI failure", async () => {
    const logs: string[] = [];
    const summary = {
      mode: "dry_run",
      run_id: "fixture",
      candidates: [{ status: "failed" }],
    } as unknown as BatchSummary;
    const candidateFailureCode = await runCli(["fixture", "--dry-run", "--json"], {
      repositoryRoot: "/fixture",
      run: async () => summary,
      log: (message) => logs.push(message),
      error: (message) => logs.push(message),
    });
    const fatalCode = await runCli(["fixture", "--dry-run"], {
      repositoryRoot: "/fixture",
      run: async () => { throw new Error("systemic"); },
      log: (message) => logs.push(message),
      error: (message) => logs.push(message),
    });

    expect(candidateFailureCode).toBe(0);
    expect(fatalCode).toBe(1);
  });
});
