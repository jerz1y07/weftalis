import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GitHubClient } from "../src/github.js";
import { runIntake } from "../src/intake.js";
import { assertSafeOutputRoot } from "../src/output.js";
import { schemaIds, validateAgainstSchema } from "../src/schema-validator.js";
import type { SubmissionManifest } from "../src/types.js";
import { createGitHubMock, fixturesDirectory } from "./helpers/github-mock.js";

const temporaryDirectories: string[] = [];
const fixedTime = "2026-07-21T08:00:00.000Z";

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function makeRepository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "weftalis-intake-test-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "packages"));
  await mkdir(path.join(root, "registry"));
  await mkdir(path.join(root, "website/generated"), { recursive: true });
  await mkdir(path.join(root, ".git"));
  await writeFile(path.join(root, "packages/sentinel.txt"), "package sentinel\n", "utf8");
  await writeFile(path.join(root, "registry/registry.json"), "registry sentinel\n", "utf8");
  await writeFile(path.join(root, "website/generated/registry.json"), "website sentinel\n", "utf8");
  return root;
}

function manifest(submissionId = "fixture-one"): SubmissionManifest {
  return {
    manifest_version: "1.0",
    submissions: [{
      record_version: "1.0",
      submission_id: submissionId,
      repository_url: "https://github.com/fixture-owner/fixture-repository",
      artifact_path: "workflows/valid-dify.yml",
      branch: "main",
      platform_hint: "dify",
      workflow_name: "Fixture Dify Workflow",
      description: "Local intake integration fixture.",
      submitter: { name_or_handle: "fixture-submitter", claims_authorship: false },
      license_claim: "MIT",
    }],
  };
}

async function writeManifest(root: string, value: SubmissionManifest): Promise<string> {
  const manifestPath = path.join(root, "candidates.json");
  await writeFile(manifestPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return manifestPath;
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

describe("local review-first intake", () => {
  it("dry-run writes nothing and leaves protected repository files unchanged", async () => {
    const root = await makeRepository();
    const manifestPath = await writeManifest(root, manifest());
    const before = await Promise.all([
      readFile(path.join(root, "packages/sentinel.txt"), "utf8"),
      readFile(path.join(root, "registry/registry.json"), "utf8"),
      readFile(path.join(root, "website/generated/registry.json"), "utf8"),
    ]);
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath,
      dryRun: true,
      github: new GitHubClient({ fetch: await createGitHubMock() }),
      now: () => fixedTime,
    });
    expect(result.processed).toHaveLength(1);
    expect(result.processed[0]?.record.moderation.current_status).toBe("needs_review");
    expect(result.processed[0]?.record.resolved_artifact.artifact.stored_path).toBeNull();
    expect(await exists(path.join(root, "intake-review"))).toBe(false);
    const after = await Promise.all([
      readFile(path.join(root, "packages/sentinel.txt"), "utf8"),
      readFile(path.join(root, "registry/registry.json"), "utf8"),
      readFile(path.join(root, "website/generated/registry.json"), "utf8"),
    ]);
    expect(after).toEqual(before);
  });

  it("writes a separated review record and verifies the stored artifact hash", async () => {
    const root = await makeRepository();
    const manifestPath = await writeManifest(root, manifest());
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath,
      github: new GitHubClient({ fetch: await createGitHubMock() }),
      now: () => fixedTime,
    });
    const processed = result.processed[0]!;
    const reviewDirectory = processed.reviewDirectory!;
    const record = JSON.parse(await readFile(path.join(reviewDirectory, "review-record.json"), "utf8"));
    const artifactPath = path.join(reviewDirectory, ...record.resolved_artifact.artifact.stored_path.split("/"));
    const fixture = await readFile(path.join(fixturesDirectory, "artifacts/valid-dify.yml"));
    expect(await readFile(artifactPath)).toEqual(fixture);
    expect(record.resolved_artifact.fingerprint.stored_artifact_matches_fetched).toBe(true);
    expect(record.moderation.automatic_publication).toBe(false);
    expect(await validateAgainstSchema(schemaIds.reviewRecord, record)).toEqual([]);
    expect(await readFile(path.join(root, "registry/registry.json"), "utf8")).toBe("registry sentinel\n");
  });

  it("re-running the same pinned source verifies and reuses the existing record", async () => {
    const root = await makeRepository();
    const manifestPath = await writeManifest(root, manifest());
    const common = {
      repositoryRoot: root,
      manifestPath,
      github: new GitHubClient({ fetch: await createGitHubMock() }),
      now: () => fixedTime,
    };
    const first = await runIntake(common);
    const second = await runIntake(common);
    expect(second.processed[0]?.reusedExisting).toBe(true);
    expect(second.processed[0]?.record.resolved_artifact.fingerprint?.sha256)
      .toBe(first.processed[0]?.record.resolved_artifact.fingerprint?.sha256);
  });

  it("detects duplicate artifacts and duplicate pinned sources within one batch", async () => {
    const root = await makeRepository();
    const value = manifest("fixture-one");
    value.submissions.push({ ...value.submissions[0]!, submission_id: "fixture-two" });
    const manifestPath = await writeManifest(root, value);
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath,
      dryRun: true,
      github: new GitHubClient({ fetch: await createGitHubMock() }),
      now: () => fixedTime,
    });
    expect(result.processed[0]?.record.duplicate_status.duplicate_artifact).toBe(false);
    expect(result.processed[1]?.record.duplicate_status).toMatchObject({
      duplicate_artifact: true,
      duplicate_source: true,
    });
  });

  it("creates a quarantined failure record for a missing artifact and continues", async () => {
    const root = await makeRepository();
    const manifestPath = await writeManifest(root, manifest());
    const result = await runIntake({
      repositoryRoot: root,
      manifestPath,
      github: new GitHubClient({ fetch: await createGitHubMock({ missingArtifact: true }) }),
      now: () => fixedTime,
    });
    const record = result.processed[0]?.record;
    expect(result.failedCount).toBe(1);
    expect(record?.moderation.current_status).toBe("quarantined");
    expect(record?.resolved_artifact.failure?.code).toBe("artifact.not_found");
    expect(record?.static_audit.artifact_available).toBe(false);
    expect(record?.resolved_artifact.artifact.stored_path).toBeNull();
  });

  it("refuses output paths that overlap Packages, Registry, or website files", async () => {
    const root = await makeRepository();
    await expect(assertSafeOutputRoot(root, path.join(root, "packages/intake")))
      .rejects.toThrow(/separate/);
    await expect(assertSafeOutputRoot(root, path.join(root, "registry")))
      .rejects.toThrow(/separate/);
    await expect(assertSafeOutputRoot(root, path.join(root, "website/generated/intake")))
      .rejects.toThrow(/separate/);
  });
});
