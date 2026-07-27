import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  GitHubClient,
  IntakeSourceError,
  normalizeGitHubRepositoryUrl,
} from "../src/github.js";
import type { CommunitySubmission } from "../src/types.js";
import {
  createGitHubMock,
  fixturesDirectory,
  pinnedCommit,
} from "./helpers/github-mock.js";

function submission(): CommunitySubmission {
  return {
    record_version: "1.0",
    repository_url: "https://github.com/fixture-owner/fixture-repository.git",
    artifact_path: "workflows/valid-dify.yml",
    branch: "main",
    platform_hint: "dify",
    workflow_name: "Fixture Dify Workflow",
    description: "Fixture submission.",
    submitter: { name_or_handle: "fixture", claims_authorship: false },
    license_claim: "MIT",
  };
}

describe("GitHub source resolution", () => {
  it("normalizes a GitHub repository URL and rejects non-repository URLs", () => {
    expect(normalizeGitHubRepositoryUrl("https://github.com/Owner/Repository.git/")).toMatchObject({
      normalizedUrl: "https://github.com/Owner/Repository",
      owner: "Owner",
      name: "Repository",
    });
    expect(() => normalizeGitHubRepositoryUrl("https://example.com/Owner/Repository"))
      .toThrow(IntakeSourceError);
  });

  it("resolves a mutable branch, verifies exact path case, and retrieves exact bytes", async () => {
    const fetch = await createGitHubMock();
    const client = new GitHubClient({ fetch });
    const identity = normalizeGitHubRepositoryUrl(submission().repository_url);
    const repository = await client.inspectRepository(identity);
    const ref = await client.resolveRef(submission(), repository);
    const retrieved = await client.retrieveArtifact(repository, ref.commit, submission().artifact_path);
    const fixture = await readFile(path.join(fixturesDirectory, "artifacts/valid-dify.yml"));
    expect(ref).toMatchObject({ kind: "branch", value: "main", wasMutable: true, commit: pinnedCommit });
    expect(Buffer.from(retrieved.bytes)).toEqual(fixture);
    expect(retrieved.verifiedPath).toBe(submission().artifact_path);
  });

  it("keeps repository-level and file-level license evidence distinct", async () => {
    const client = new GitHubClient({ fetch: await createGitHubMock() });
    const repository = await client.inspectRepository(normalizeGitHubRepositoryUrl(submission().repository_url));
    const artifact = await readFile(path.join(fixturesDirectory, "artifacts/valid-dify.yml"), "utf8");
    const evidence = await client.collectLicenseEvidence(repository, pinnedCommit, "MIT", artifact);
    expect(evidence.repository_level).toMatchObject({ status: "found", spdx_id: "MIT", scope: "repository-level" });
    expect(evidence.file_level).toMatchObject({ status: "missing", spdx_identifiers: [] });
    expect(evidence.submission_claim).toBe("MIT");
  });

  it("records missing and ambiguous license evidence conservatively", async () => {
    const identity = normalizeGitHubRepositoryUrl(submission().repository_url);
    const missingClient = new GitHubClient({ fetch: await createGitHubMock({ missingLicense: true }) });
    const ambiguousClient = new GitHubClient({ fetch: await createGitHubMock({ ambiguousLicense: true }) });
    const missingRepo = await missingClient.inspectRepository(identity);
    const ambiguousRepo = await ambiguousClient.inspectRepository(identity);
    expect((await missingClient.collectLicenseEvidence(missingRepo, pinnedCommit, undefined, "fixture"))
      .repository_level.status).toBe("missing");
    expect((await ambiguousClient.collectLicenseEvidence(ambiguousRepo, pinnedCommit, undefined, "fixture"))
      .repository_level.status).toBe("ambiguous");
  });

  it("rejects a missing artifact and a case-mismatched path", async () => {
    const identity = normalizeGitHubRepositoryUrl(submission().repository_url);
    const missingClient = new GitHubClient({ fetch: await createGitHubMock({ missingArtifact: true }) });
    const missingRepo = await missingClient.inspectRepository(identity);
    await expect(missingClient.retrieveArtifact(missingRepo, pinnedCommit, submission().artifact_path))
      .rejects.toMatchObject({ code: "artifact.not_found" });

    const caseClient = new GitHubClient({ fetch: await createGitHubMock({ returnedPath: "Workflows/valid-dify.yml" }) });
    const caseRepo = await caseClient.inspectRepository(identity);
    await expect(caseClient.retrieveArtifact(caseRepo, pinnedCommit, submission().artifact_path))
      .rejects.toMatchObject({ code: "artifact.path_case_mismatch" });
  });

  it("uses an optional token only in request headers and never in errors", async () => {
    const fakeToken = "ghp_FAKEONLYFORINTAKETESTS123456789";
    let authorization = "";
    const mock = await createGitHubMock({
      missingArtifact: true,
      onRequest: (_url, init) => {
        authorization = new Headers(init?.headers).get("Authorization") ?? "";
      },
    });
    const client = new GitHubClient({ fetch: mock, token: fakeToken });
    const repository = await client.inspectRepository(normalizeGitHubRepositoryUrl(submission().repository_url));
    let error: unknown;
    try {
      await client.retrieveArtifact(repository, pinnedCommit, submission().artifact_path);
    } catch (caught) {
      error = caught;
    }
    expect(authorization).toBe(`Bearer ${fakeToken}`);
    expect(JSON.stringify(error)).not.toContain(fakeToken);
    expect(error).toMatchObject({ code: "artifact.not_found" });
  });
});
