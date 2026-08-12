import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gitBlobSha1 } from "../../src/fingerprint.js";
import type { FetchLike } from "../../src/github.js";

const testsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const intakeDirectory = path.resolve(testsDirectory, "..");
export const fixturesDirectory = path.join(intakeDirectory, "fixtures");
export const pinnedCommit = "0123456789abcdef0123456789abcdef01234567";

async function fixtureJson(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(fixturesDirectory, "github", name), "utf8")) as Record<string, unknown>;
}

export interface GitHubMockOptions {
  artifactFixture?: string;
  artifactBytes?: Uint8Array;
  artifactPath?: string;
  missingArtifact?: boolean;
  returnedPath?: string;
  ambiguousLicense?: boolean;
  missingLicense?: boolean;
  reportedBlobSha?: string | null;
  reportedSize?: number | null;
  repositoryPrivate?: boolean;
  repositoryVisibility?: string;
  useRawResponse?: boolean;
  rawResponseBytes?: Uint8Array;
  onRequest?: (url: string, init: RequestInit | undefined) => void;
}

export async function createGitHubMock(options: GitHubMockOptions = {}): Promise<FetchLike> {
  const artifactPath = options.artifactPath ?? "workflows/valid-dify.yml";
  const artifact = options.artifactBytes
    ? Buffer.from(options.artifactBytes)
    : await readFile(path.join(
      fixturesDirectory,
      "artifacts",
      options.artifactFixture ?? "valid-dify.yml",
    ));
  const repository = await fixtureJson("repository.json");
  if (options.repositoryPrivate !== undefined) repository.private = options.repositoryPrivate;
  if (options.repositoryVisibility !== undefined) repository.visibility = options.repositoryVisibility;
  const commit = await fixtureJson("commit.json");
  const license = await fixtureJson(options.ambiguousLicense ? "ambiguous-license.json" : "license.json");
  const missing = await fixtureJson("missing-artifact.json");

  return async (input, init) => {
    const url = String(input);
    options.onRequest?.(url, init);
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      return new Response(Buffer.from(options.rawResponseBytes ?? artifact));
    }
    if (url === "https://api.github.com/repos/fixture-owner/fixture-repository") {
      return Response.json(repository);
    }
    if (url.includes("/commits/")) {
      return Response.json(commit);
    }
    if (url.includes("/contents/")) {
      if (options.missingArtifact) return Response.json(missing, { status: 404 });
      const response: Record<string, unknown> = {
        type: "file",
        name: path.posix.basename(artifactPath),
        path: options.returnedPath ?? artifactPath,
        size: options.reportedSize === undefined ? artifact.byteLength : options.reportedSize,
        encoding: options.useRawResponse ? "none" : "base64",
        content: options.useRawResponse ? null : artifact.toString("base64"),
        download_url: `https://raw.githubusercontent.com/fixture-owner/fixture-repository/${pinnedCommit}/${artifactPath}`,
        html_url: `https://github.com/fixture-owner/fixture-repository/blob/${pinnedCommit}/${artifactPath}`,
      };
      if (options.reportedSize === null) delete response.size;
      if (options.reportedBlobSha !== null) {
        response.sha = options.reportedBlobSha ?? gitBlobSha1(artifact);
      }
      return Response.json(response);
    }
    if (url.includes("/license?")) {
      return options.missingLicense
        ? Response.json(missing, { status: 404 })
        : Response.json(license);
    }
    return Response.json({ message: "Unexpected mock URL" }, { status: 500 });
  };
}
