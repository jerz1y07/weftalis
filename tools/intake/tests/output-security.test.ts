import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GitHubClient } from "../src/github.js";
import { runIntake } from "../src/intake.js";
import { assertContainedReviewPath } from "../src/output.js";
import type { SubmissionManifest } from "../src/types.js";
import { createGitHubMock } from "./helpers/github-mock.js";

const temporaryDirectories: string[] = [];
const fixedTime = "2026-07-21T08:00:00.000Z";

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function makeRepository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "weftalis-output-security-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "packages"));
  await mkdir(path.join(root, "registry"));
  await mkdir(path.join(root, "website"));
  await mkdir(path.join(root, ".git"));
  await writeFile(path.join(root, "packages/sentinel.txt"), "protected\n", "utf8");
  return root;
}

function manifest(): SubmissionManifest {
  return {
    manifest_version: "1.0",
    submissions: [{
      record_version: "1.0",
      repository_url: "https://github.com/fixture-owner/fixture-repository",
      artifact_path: "workflows/valid-dify.yml",
      branch: "main",
      platform_hint: "dify",
      workflow_name: "Output Security Fixture",
      description: "Symlink containment regression fixture.",
      submitter: { name_or_handle: "fixture", claims_authorship: false },
    }],
  };
}

async function manifestPath(root: string): Promise<string> {
  const candidate = path.join(root, "manifest.json");
  await writeFile(candidate, `${JSON.stringify(manifest())}\n`, "utf8");
  return candidate;
}

async function run(root: string, dryRun = false) {
  return runIntake({
    repositoryRoot: root,
    manifestPath: await manifestPath(root),
    dryRun,
    github: new GitHubClient({ fetch: await createGitHubMock() }),
    now: () => fixedTime,
  });
}

describe("symlink-safe review output containment", () => {
  it("rejects a symbolic link at intake-review", async () => {
    const root = await makeRepository();
    const target = path.join(root, "review-root-target");
    await mkdir(target);
    await symlink(target, path.join(root, "intake-review"), "dir");
    await expect(run(root)).rejects.toThrow(/symbolic link/);
  });

  it("rejects a symbolic link at reviews", async () => {
    const root = await makeRepository();
    const outputRoot = path.join(root, "intake-review");
    const target = path.join(root, "reviews-target");
    await mkdir(outputRoot);
    await mkdir(target);
    await symlink(target, path.join(outputRoot, "reviews"), "dir");
    await expect(run(root)).rejects.toThrow(/symbolic link/);
  });

  it("rejects a symbolic link at a staging path", async () => {
    const root = await makeRepository();
    const outputRoot = path.join(root, "intake-review");
    const reviews = path.join(outputRoot, "reviews");
    const target = path.join(root, "staging-target");
    const staging = path.join(reviews, ".staging-attacker");
    await mkdir(reviews, { recursive: true });
    await mkdir(target);
    await symlink(target, staging, "dir");
    await expect(assertContainedReviewPath(outputRoot, staging)).rejects.toThrow(/symbolic link/);
  });

  it("rejects a symbolic link at a stored artifact before reading it", async () => {
    const root = await makeRepository();
    const first = await run(root);
    const reviewDirectory = first.processed[0]!.reviewDirectory!;
    const record = first.processed[0]!.record;
    const storedPath = path.join(
      reviewDirectory,
      ...record.resolved_artifact.artifact.stored_path!.split("/"),
    );
    await unlink(storedPath);
    await symlink(path.join(root, "packages/sentinel.txt"), storedPath, "file");
    await expect(run(root)).rejects.toThrow(/symbolic link/);
  });

  it("rejects a symbolic link at an existing review record before reading it", async () => {
    const root = await makeRepository();
    const first = await run(root);
    const reviewRecordPath = path.join(first.processed[0]!.reviewDirectory!, "review-record.json");
    await unlink(reviewRecordPath);
    await symlink(path.join(root, "packages/sentinel.txt"), reviewRecordPath, "file");
    await expect(run(root)).rejects.toThrow(/symbolic link|safe regular file/);
  });

  it("rejects a symbolic link at the final review destination", async () => {
    const root = await makeRepository();
    const dryRun = await run(root, true);
    const outputRoot = path.join(root, "intake-review");
    const reviews = path.join(outputRoot, "reviews");
    const target = path.join(root, "final-target");
    await mkdir(reviews, { recursive: true });
    await mkdir(target);
    await symlink(target, path.join(reviews, dryRun.processed[0]!.record.review_id), "dir");
    await expect(run(root)).rejects.toThrow(/symbolic link/);
  });
});
