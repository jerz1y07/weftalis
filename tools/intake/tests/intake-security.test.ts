import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../src/cli.js";
import { GitHubClient } from "../src/github.js";
import { runIntake } from "../src/intake.js";
import type { Platform, SubmissionManifest } from "../src/types.js";
import { createGitHubMock, fixturesDirectory } from "./helpers/github-mock.js";

const temporaryDirectories: string[] = [];
const fixedTime = "2026-07-21T08:00:00.000Z";

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function makeRepository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "weftalis-intake-security-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "packages"));
  await mkdir(path.join(root, "registry"));
  await mkdir(path.join(root, "website"));
  await mkdir(path.join(root, ".git"));
  return root;
}

function manifest(artifactPath = "workflows/valid-dify.yml", platformHint: Platform = "dify"): SubmissionManifest {
  return {
    manifest_version: "1.0",
    submissions: [{
      record_version: "1.0",
      repository_url: "https://github.com/fixture-owner/fixture-repository",
      artifact_path: artifactPath,
      branch: "main",
      platform_hint: platformHint,
      workflow_name: "Security Regression Fixture",
      description: "Focused Phase 12A security regression fixture.",
      submitter: { name_or_handle: "fixture", claims_authorship: false },
    }],
  };
}

async function writeManifest(root: string, value: SubmissionManifest): Promise<string> {
  const candidate = path.join(root, "manifest.json");
  await writeFile(candidate, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return candidate;
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

describe("malformed artifact quarantine", () => {
  it("quarantines malformed Dify YAML without semantic analysis and preserves only the isolated source bytes", async () => {
    const root = await makeRepository();
    const artifactPath = "workflows/malformed-dify.yml";
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath: await writeManifest(root, manifest(artifactPath, "dify")),
      github: new GitHubClient({
        fetch: await createGitHubMock({ artifactFixture: "malformed-dify.yml", artifactPath }),
      }),
      now: () => fixedTime,
    });
    const processed = result.processed[0]!;
    expect(processed.record.moderation.current_status).toBe("quarantined");
    expect(processed.record.static_audit).toMatchObject({
      parsing_status: "needs_review",
      recommended_moderation_status: "quarantined",
      nodes: [],
      node_count: null,
    });
    expect(processed.record.static_audit.warnings).toContain(
      "Parse error category: malformed_yaml. Semantic analysis was not attempted.",
    );
    const stored = path.join(
      processed.reviewDirectory!,
      ...processed.record.resolved_artifact.artifact.stored_path!.split("/"),
    );
    expect(await readFile(stored)).toEqual(await readFile(path.join(fixturesDirectory, "artifacts/malformed-dify.yml")));
  });

  it("quarantines malformed n8n JSON without semantic analysis and preserves only the isolated source bytes", async () => {
    const root = await makeRepository();
    const artifactPath = "workflows/malformed-n8n.json";
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath: await writeManifest(root, manifest(artifactPath, "n8n")),
      github: new GitHubClient({
        fetch: await createGitHubMock({ artifactFixture: "malformed-n8n.json", artifactPath }),
      }),
      now: () => fixedTime,
    });
    const processed = result.processed[0]!;
    expect(processed.record.moderation.current_status).toBe("quarantined");
    expect(processed.record.static_audit).toMatchObject({
      parsing_status: "needs_review",
      recommended_moderation_status: "quarantined",
      nodes: [],
      node_count: null,
    });
    expect(processed.record.static_audit.warnings).toContain(
      "Parse error category: malformed_json. Semantic analysis was not attempted.",
    );
    const stored = path.join(
      processed.reviewDirectory!,
      ...processed.record.resolved_artifact.artifact.stored_path!.split("/"),
    );
    expect(await readFile(stored)).toEqual(await readFile(path.join(fixturesDirectory, "artifacts/malformed-n8n.json")));
  });
});

describe("fail-closed Git blob integrity", () => {
  it("accepts a matching GitHub-reported Git blob SHA", async () => {
    const root = await makeRepository();
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath: await writeManifest(root, manifest()),
      dryRun: true,
      github: new GitHubClient({ fetch: await createGitHubMock() }),
      now: () => fixedTime,
    });
    expect(result.processed[0]!.record.resolved_artifact).toMatchObject({
      resolution_status: "resolved",
      failure: null,
      fingerprint: { git_blob_sha_matches: true },
    });
    expect(result.processed[0]!.record.moderation.current_status).toBe("needs_review");
  });

  it("quarantines a mismatched GitHub-reported Git blob SHA while retaining SHA-256", async () => {
    const root = await makeRepository();
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath: await writeManifest(root, manifest()),
      dryRun: true,
      github: new GitHubClient({ fetch: await createGitHubMock({ reportedBlobSha: "0".repeat(40) }) }),
      now: () => fixedTime,
    });
    const record = result.processed[0]!.record;
    expect(record.moderation.current_status).toBe("quarantined");
    expect(record.resolved_artifact.failure?.code).toBe("artifact.git_blob_mismatch");
    expect(record.resolved_artifact.fingerprint?.git_blob_sha_matches).toBe(false);
    expect(record.resolved_artifact.fingerprint?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("quarantines a missing GitHub-reported Git blob SHA as integrity unverified", async () => {
    const root = await makeRepository();
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath: await writeManifest(root, manifest()),
      dryRun: true,
      github: new GitHubClient({ fetch: await createGitHubMock({ reportedBlobSha: null }) }),
      now: () => fixedTime,
    });
    const record = result.processed[0]!.record;
    expect(record.moderation.current_status).toBe("quarantined");
    expect(record.resolved_artifact.failure?.code).toBe("artifact.git_blob_unverified");
    expect(record.resolved_artifact.fingerprint).toMatchObject({
      git_blob_sha_reported: null,
      git_blob_sha_matches: null,
    });
    expect(record.resolved_artifact.fingerprint?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("review metadata and log redaction", () => {
  it("keeps the exact secret-like fixture value only in the isolated artifact, not metadata or logs", async () => {
    const root = await makeRepository();
    const fakeValue = "FAKE_ONLY_FOR_INTAKE_TESTS_12345";
    const artifactPath = "workflows/secret-like-value.yml";
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath: await writeManifest(root, manifest(artifactPath, "dify")),
      github: new GitHubClient({
        fetch: await createGitHubMock({ artifactFixture: "secret-like-value.yml", artifactPath }),
      }),
      now: () => fixedTime,
    });
    const processed = result.processed[0]!;
    expect(processed.record.moderation.current_status).toBe("quarantined");
    const metadataFiles = (await readdir(processed.reviewDirectory!)).filter((name) => name.endsWith(".json"));
    for (const file of metadataFiles) {
      expect(await readFile(path.join(processed.reviewDirectory!, file), "utf8")).not.toContain(fakeValue);
    }
    const stored = path.join(
      processed.reviewDirectory!,
      ...processed.record.resolved_artifact.artifact.stored_path!.split("/"),
    );
    expect(await readFile(stored, "utf8")).toContain(fakeValue);

    let captured = "";
    const code = await runCli(["--manifest", "fixture.json"], {
      repositoryRoot: root,
      run: async () => result,
      log: (message) => { captured += message; },
      error: (message) => { captured += message; },
    });
    expect(code).toBe(0);
    expect(captured).not.toContain(fakeValue);
  });

  it("rejects a secret-like manifest before network retrieval or review-record writing", async () => {
    const root = await makeRepository();
    const value = manifest();
    value.submissions[0]!.notes = "api_key: FAKE_MANIFEST_SECRET_VALUE_12345";
    let requestCount = 0;
    const github = new GitHubClient({
      fetch: await createGitHubMock({ onRequest: () => { requestCount += 1; } }),
    });
    await expect(runIntake({
      repositoryRoot: root,
      manifestPath: await writeManifest(root, value),
      github,
      now: () => fixedTime,
    })).rejects.toThrow(/potential secret-like values/);
    expect(requestCount).toBe(0);
    expect(await exists(path.join(root, "intake-review"))).toBe(false);
  });
});
