import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../src/cli.js";
import {
  createIntakeManifest,
  deduplicateCandidates,
  runDiscovery,
} from "../src/discovery.js";
import {
  GitHubClient,
  githubCandidateIdentity,
  GitHubRepositoryTreeAdapter,
  type FetchLike,
} from "../src/github.js";
import {
  assertDiscoveryOutputPath,
  DiscoveryOutputError,
  serializeCandidates,
  writeDiscoveryWorkspace,
} from "../src/output.js";
import type { DiscoverySource } from "../src/types.js";

type JsonRecord = Record<string, unknown>;

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/github-api.json",
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as {
  repository: JsonRecord;
  commit: JsonRecord;
  tree: JsonRecord;
  license: JsonRecord;
};
const discoveredAt = "2026-08-20T00:00:00.000Z";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

function source(sourceId = "fixture:n8n", platform: "n8n" | "dify" = "n8n"): DiscoverySource {
  return {
    source_id: sourceId,
    label: "Fixture workflows",
    adapter: "github_repository_tree",
    platform,
    configuration: {
      owner: "FixtureOrg",
      repository: "workflow-fixtures",
      include_path_prefixes: ["workflows/"],
      artifact_extensions: platform === "n8n" ? [".json"] : [".yml"],
    },
  };
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function fixtureFetch(options: {
  licenseMissing?: boolean;
  inspectHeaders?: (headers: Headers) => void;
} = {}): FetchLike {
  return async (input, init) => {
    options.inspectHeaders?.(new Headers(init?.headers));
    const url = new URL(String(input));
    if (url.pathname === "/repos/FixtureOrg/workflow-fixtures") {
      return jsonResponse(fixture.repository);
    }
    if (url.pathname.endsWith("/commits/main")) return jsonResponse(fixture.commit);
    if (url.pathname.endsWith("/git/trees/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")) {
      return jsonResponse(fixture.tree);
    }
    if (url.pathname.endsWith("/license")) {
      return options.licenseMissing
        ? jsonResponse({ message: "Not Found" }, { status: 404 })
        : jsonResponse(fixture.license);
    }
    return jsonResponse({ message: "Not Found" }, { status: 404 });
  };
}

function adapter(fetchImpl: FetchLike = fixtureFetch()): GitHubRepositoryTreeAdapter {
  return new GitHubRepositoryTreeAdapter(new GitHubClient({ fetchImpl }));
}

describe("GitHub repository-tree normalization", () => {
  it("normalizes real artifact coordinates without making authorship or trust claims", async () => {
    const result = await adapter().discover(source(), { discoveredAt });
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      title: "alpha workflow",
      platform: "n8n",
      repository: {
        url: "https://github.com/FixtureOrg/workflow-fixtures",
        owner: "FixtureOrg",
        visibility: "public",
      },
      immutable_ref: {
        commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      artifact: {
        path: "workflows/alpha-workflow.json",
        format: "n8n_json",
        git_blob_sha: "1111111111111111111111111111111111111111",
      },
      license_evidence: {
        status: "found",
        spdx_id: "MIT",
        scope: "repository-level",
      },
      repository_owner_evidence: {
        value: "FixtureOrg",
        basis: "repository_owner",
      },
    });
    expect(result.candidates[0]!.warnings.map((item) => item.code)).toContain(
      "repository_owner_not_artifact_author",
    );
  });

  it("keeps missing optional license metadata unknown instead of inventing it", async () => {
    const result = await adapter(fixtureFetch({ licenseMissing: true }))
      .discover(source(), { discoveredAt });
    expect(result.candidates[0]!.license_evidence).toMatchObject({
      status: "missing",
      spdx_id: null,
      evidence_url: null,
    });
  });

  it("records malformed matching upstream entries as factual skips", async () => {
    const result = await adapter().discover(source(), { discoveredAt });
    expect(result.skipped).toEqual([
      {
        source_id: "fixture:n8n",
        artifact_path: null,
        reason: "malformed_upstream_result",
        detail: "A GitHub blob entry did not contain a path.",
      },
      {
        source_id: "fixture:n8n",
        artifact_path: "workflows/empty.json",
        reason: "malformed_upstream_result",
        detail: "The matching GitHub blob entry lacked a valid blob identity or size.",
      },
    ]);
  });
});

describe("deterministic identity and deduplication", () => {
  it("deduplicates repeated discovery of the same immutable artifact", async () => {
    const first = await adapter().discover(source("fixture:first"), { discoveredAt });
    const second = await adapter().discover(source("fixture:second"), { discoveredAt });
    const result = deduplicateCandidates([...first.candidates, ...second.candidates]);
    expect(result.candidates).toHaveLength(2);
    expect(result.duplicateCount).toBe(2);
    expect(result.candidates[0]!.discovery_sources.map((item) => item.source_id)).toEqual([
      "fixture:first",
      "fixture:second",
    ]);
  });

  it("does not merge different artifact paths in the same repository", async () => {
    const result = await adapter().discover(source(), { discoveredAt });
    const deduplicated = deduplicateCandidates(result.candidates);
    expect(deduplicated.candidates).toHaveLength(2);
    expect(new Set(deduplicated.candidates.map((item) => item.artifact.path)).size).toBe(2);
  });

  it("includes the immutable commit in identity", () => {
    const first = githubCandidateIdentity("Owner", "Repo", "a".repeat(40), "workflows/a.json");
    const second = githubCandidateIdentity("Owner", "Repo", "b".repeat(40), "workflows/a.json");
    expect(first).not.toBe(second);
  });

  it("produces byte-stable ordering when time and upstream responses are fixed", async () => {
    const sources = [source("fixture:second"), source("fixture:first")];
    const first = await runDiscovery({
      limit: 4,
      discoveredAt,
      githubAuthenticated: false,
    }, sources, [adapter()]);
    const second = await runDiscovery({
      limit: 4,
      discoveredAt,
      githubAuthenticated: false,
    }, [...sources].reverse(), [adapter()]);
    expect(serializeCandidates(first, "jsonl")).toBe(serializeCandidates(second, "jsonl"));
    expect(first.report).toEqual(second.report);
    expect(first.report).toMatchObject({
      raw_candidate_count: 4,
      unique_candidate_count: 2,
      duplicate_count: 2,
      source_distribution: {
        "fixture:first": 2,
        "fixture:second": 2,
      },
    });
  });
});

describe("GitHub errors and authentication", () => {
  it("reports rate limiting without depending on live GitHub", async () => {
    const rateLimited: FetchLike = async () => jsonResponse(
      { message: "rate limit" },
      { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "123" } },
    );
    const result = await runDiscovery({
      limit: 1,
      discoveredAt,
      githubAuthenticated: false,
    }, [source()], [adapter(rateLimited)]);
    expect(result.report.source_errors).toEqual([{
      source_id: "fixture:n8n",
      code: "github_rate_limit",
      message: "GitHub API rate limit prevented discovery. Reset epoch: 123.",
    }]);
    expect(result.candidates).toEqual([]);
  });

  it("sends no Authorization header in unauthenticated mode", async () => {
    const observed: Array<string | null> = [];
    const result = await adapter(fixtureFetch({
      inspectHeaders: (headers) => observed.push(headers.get("authorization")),
    })).discover(source(), { discoveredAt });
    expect(result.candidates).toHaveLength(2);
    expect(observed.every((value) => value === null)).toBe(true);
  });

  it("uses configured authentication without leaking the token to output or errors", async () => {
    const secretToken = "fixture-auth-value";
    const observed: Array<string | null> = [];
    const logs: string[] = [];
    const errors: string[] = [];
    const code = await runCli([
      "--limit", "1", "--source", "fixture:n8n", "--dry-run",
    ], {
      environment: { GITHUB_TOKEN: secretToken },
      sources: [source()],
      fetchImpl: fixtureFetch({
        inspectHeaders: (headers) => observed.push(headers.get("authorization")),
      }),
      now: () => new Date(discoveredAt),
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    });
    expect(code).toBe(0);
    expect(observed.every((value) => value === `Bearer ${secretToken}`)).toBe(true);
    expect(`${logs.join("\n")}\n${errors.join("\n")}`).not.toContain(secretToken);
  });
});

describe("Intake handoff and repository isolation", () => {
  it("creates an existing-Intake-compatible manifest without authorship or license claims", async () => {
    const candidates = (await adapter().discover(source(), { discoveredAt })).candidates;
    const manifest = createIntakeManifest(candidates);
    expect(manifest.manifest_version).toBe("1.0");
    expect(manifest.submissions).toHaveLength(2);
    expect(manifest.submissions[0]).toMatchObject({
      record_version: "1.0",
      repository_url: "https://github.com/FixtureOrg/workflow-fixtures",
      artifact_path: "workflows/alpha-workflow.json",
      commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      platform_hint: "n8n",
      submitter: {
        name_or_handle: "Weft Place Discovery",
        claims_authorship: false,
      },
    });
    expect(manifest.submissions[0]).not.toHaveProperty("upstream_author_or_organization");
    expect(manifest.submissions[0]).not.toHaveProperty("license_claim");
  });

  it("rejects protected repository paths and writes only an ignored run workspace", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "weft-place-discovery-test-"));
    temporaryDirectories.push(repositoryRoot);
    expect(() => assertDiscoveryOutputPath(repositoryRoot, repositoryRoot)).toThrow(DiscoveryOutputError);
    expect(() => assertDiscoveryOutputPath(
      repositoryRoot,
      path.join(repositoryRoot, "packages", "candidate"),
    )).toThrow(DiscoveryOutputError);

    const result = await runDiscovery({
      limit: 2,
      discoveredAt,
      githubAuthenticated: false,
    }, [source()], [adapter()]);
    const workspace = await writeDiscoveryWorkspace({
      repositoryRoot,
      outputDirectory: path.join(repositoryRoot, "discovery-workspace", "fixture-run"),
      format: "jsonl",
      result,
    });
    const manifest = JSON.parse(await readFile(workspace.intakeManifestFile, "utf8")) as JsonRecord;
    expect(manifest.manifest_version).toBe("1.0");
    await expect(readFile(path.join(repositoryRoot, "packages", "candidate"), "utf8")).rejects.toThrow();
  });
});
