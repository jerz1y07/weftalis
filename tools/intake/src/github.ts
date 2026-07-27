import type {
  CommunitySubmission,
  LicenseEvidence,
  RepositoryIdentity,
  RequestedRefKind,
  RetrievedArtifact,
} from "./types.js";

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class IntakeSourceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "IntakeSourceError";
  }
}

interface GitHubClientOptions {
  fetch?: FetchLike;
  token?: string;
  maximumArtifactBytes?: number;
}

interface RepositoryMetadata {
  identity: RepositoryIdentity;
  defaultBranch: string;
}

interface ResolvedRef {
  kind: RequestedRefKind;
  value: string;
  wasMutable: boolean;
  commit: string;
}

const githubApi = "https://api.github.com";
const defaultMaximumArtifactBytes = 10 * 1024 * 1024;

function assertSafeRepositoryPart(value: string, label: string): void {
  if (!/^[A-Za-z0-9_.-]+$/.test(value) || value === "." || value === "..") {
    throw new IntakeSourceError("repository.invalid_url", `The GitHub ${label} is not valid.`);
  }
}

export function normalizeGitHubRepositoryUrl(submittedUrl: string): RepositoryIdentity {
  let parsed: URL;
  try {
    parsed = new URL(submittedUrl);
  } catch {
    throw new IntakeSourceError("repository.invalid_url", "The repository URL is not valid.");
  }

  if (
    parsed.protocol !== "https:"
    || parsed.hostname.toLowerCase() !== "github.com"
    || parsed.port
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new IntakeSourceError(
      "repository.unsupported_url",
      "Only a public https://github.com/OWNER/REPOSITORY URL is supported.",
    );
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new IntakeSourceError(
      "repository.unsupported_url",
      "The repository URL must identify exactly one GitHub repository.",
    );
  }
  const owner = parts[0]!;
  const rawName = parts[1]!;
  const name = rawName.toLowerCase().endsWith(".git") ? rawName.slice(0, -4) : rawName;
  assertSafeRepositoryPart(owner, "owner");
  assertSafeRepositoryPart(name, "repository name");

  return {
    submittedUrl,
    normalizedUrl: `https://github.com/${owner}/${name}`,
    owner,
    name,
  };
}

function encodeRepositoryPath(value: string): string {
  return value.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function isFullCommit(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]{40}$/.test(value);
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function fileLevelEvidence(text: string | null): LicenseEvidence["file_level"] {
  if (text === null) {
    return {
      status: "not_scanned",
      spdx_identifiers: [],
      method: "The artifact was unavailable.",
      limitations: ["No file-level license header scan was possible."],
    };
  }
  const header = text.split(/\r?\n/, 100).join("\n");
  const identifiers = [...header.matchAll(/SPDX-License-Identifier:\s*([^\s*#]+)/gi)]
    .map((match) => match[1]!)
    .filter((value, index, all) => all.indexOf(value) === index);
  return {
    status: identifiers.length === 0 ? "missing" : identifiers.length === 1 ? "found" : "ambiguous",
    spdx_identifiers: identifiers,
    method: "Static scan of the first 100 artifact lines for SPDX-License-Identifier headers.",
    limitations: [
      "Header text is evidence only; it does not prove authorship, ownership, or legal permission.",
      "Absence of an SPDX header does not establish that the file is unlicensed.",
    ],
  };
}

export class GitHubClient {
  private readonly fetch: FetchLike;
  private readonly token: string | undefined;
  private readonly maximumArtifactBytes: number;

  constructor(options: GitHubClientOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.token = options.token;
    this.maximumArtifactBytes = options.maximumArtifactBytes ?? defaultMaximumArtifactBytes;
  }

  private headers(accept = "application/vnd.github+json"): HeadersInit {
    return {
      Accept: accept,
      "User-Agent": "weftalis-local-intake",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private requestInit(accept?: string): RequestInit {
    return {
      headers: this.headers(accept),
      signal: AbortSignal.timeout(30_000),
    };
  }

  private async requestJson(url: string, notFoundCode: string): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetch(url, this.requestInit());
    } catch {
      throw new IntakeSourceError("github.network_error", "GitHub could not be reached.");
    }
    if (response.status === 404) {
      throw new IntakeSourceError(notFoundCode, "The requested public GitHub resource was not found.");
    }
    if (response.status === 403 || response.status === 429) {
      throw new IntakeSourceError(
        "github.rate_limited",
        "GitHub refused the request or the public API rate limit was reached.",
      );
    }
    if (!response.ok) {
      throw new IntakeSourceError("github.request_failed", `GitHub returned HTTP ${response.status}.`);
    }
    try {
      const value = await response.json() as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
      return value as Record<string, unknown>;
    } catch {
      throw new IntakeSourceError("github.invalid_response", "GitHub returned an unexpected response.");
    }
  }

  async inspectRepository(identity: RepositoryIdentity): Promise<RepositoryMetadata> {
    const data = await this.requestJson(
      `${githubApi}/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.name)}`,
      "repository.not_found",
    );
    const defaultBranch = safeString(data.default_branch);
    if (!defaultBranch) {
      throw new IntakeSourceError("repository.missing_default_branch", "The repository has no readable default branch.");
    }
    const fullName = safeString(data.full_name);
    const fullNameParts = fullName?.split("/");
    const owner = fullNameParts?.length === 2 ? fullNameParts[0]! : identity.owner;
    const name = fullNameParts?.length === 2 ? fullNameParts[1]! : identity.name;
    assertSafeRepositoryPart(owner, "owner");
    assertSafeRepositoryPart(name, "repository name");
    return {
      identity: {
        ...identity,
        owner,
        name,
        normalizedUrl: `https://github.com/${owner}/${name}`,
      },
      defaultBranch,
    };
  }

  async resolveRef(
    submission: CommunitySubmission,
    repository: RepositoryMetadata,
  ): Promise<ResolvedRef> {
    let kind: RequestedRefKind;
    let value: string;
    if (submission.commit) {
      kind = "commit";
      value = submission.commit.toLowerCase();
    } else if (submission.branch) {
      kind = "branch";
      value = submission.branch;
    } else if (submission.tag) {
      kind = "tag";
      value = submission.tag;
    } else {
      kind = "default_branch";
      value = repository.defaultBranch;
    }

    const data = await this.requestJson(
      `${githubApi}/repos/${encodeURIComponent(repository.identity.owner)}/${encodeURIComponent(repository.identity.name)}/commits/${encodeURIComponent(value)}`,
      "ref.not_found",
    );
    if (!isFullCommit(data.sha)) {
      throw new IntakeSourceError("ref.invalid_resolution", "GitHub did not resolve the ref to a full commit SHA.");
    }
    const commit = data.sha.toLowerCase();
    if (kind === "commit" && commit !== value) {
      throw new IntakeSourceError("ref.commit_mismatch", "The requested commit did not resolve exactly.");
    }
    return { kind, value, wasMutable: kind !== "commit", commit };
  }

  async retrieveArtifact(
    repository: RepositoryMetadata,
    commit: string,
    artifactPath: string,
  ): Promise<RetrievedArtifact> {
    const encodedPath = encodeRepositoryPath(artifactPath);
    const contentsApiUrl = `${githubApi}/repos/${encodeURIComponent(repository.identity.owner)}/${encodeURIComponent(repository.identity.name)}/contents/${encodedPath}?ref=${commit}`;
    const immutableRawUrl = `https://raw.githubusercontent.com/${repository.identity.owner}/${repository.identity.name}/${commit}/${encodedPath}`;
    const data = await this.requestJson(contentsApiUrl, "artifact.not_found");
    if (data.type !== "file") {
      throw new IntakeSourceError("artifact.not_file", "The exact artifact path does not identify a regular file.");
    }
    const verifiedPath = safeString(data.path);
    if (!verifiedPath || verifiedPath !== artifactPath) {
      throw new IntakeSourceError(
        "artifact.path_case_mismatch",
        "The artifact path does not match the exact case-sensitive upstream path.",
      );
    }
    const reportedSize = typeof data.size === "number" ? data.size : null;
    if (reportedSize !== null && reportedSize > this.maximumArtifactBytes) {
      throw new IntakeSourceError("artifact.too_large", "The artifact exceeds the local intake size limit.");
    }

    let bytes: Uint8Array;
    if (data.encoding === "base64" && typeof data.content === "string") {
      bytes = Buffer.from(data.content.replace(/\s/g, ""), "base64");
    } else {
      let parsedRawUrl: URL;
      try {
        parsedRawUrl = new URL(immutableRawUrl);
      } catch {
        throw new IntakeSourceError("artifact.missing_content", "GitHub did not provide retrievable artifact bytes.");
      }
      if (parsedRawUrl.protocol !== "https:" || parsedRawUrl.hostname !== "raw.githubusercontent.com") {
        throw new IntakeSourceError("artifact.unsafe_download_url", "GitHub returned an unsupported artifact download URL.");
      }
      let response: Response;
      try {
        response = await this.fetch(parsedRawUrl, this.requestInit("application/octet-stream"));
      } catch {
        throw new IntakeSourceError("github.network_error", "The exact artifact bytes could not be retrieved.");
      }
      if (!response.ok) {
        throw new IntakeSourceError("artifact.download_failed", `Artifact retrieval returned HTTP ${response.status}.`);
      }
      bytes = new Uint8Array(await response.arrayBuffer());
    }

    if (bytes.byteLength > this.maximumArtifactBytes) {
      throw new IntakeSourceError("artifact.too_large", "The artifact exceeds the local intake size limit.");
    }
    if (reportedSize !== null && bytes.byteLength !== reportedSize) {
      throw new IntakeSourceError("artifact.size_mismatch", "Fetched bytes do not match GitHub's reported file size.");
    }
    return {
      bytes,
      verifiedPath,
      contentsApiUrl,
      rawUrl: immutableRawUrl,
      reportedGitBlobSha: safeString(data.sha)?.toLowerCase() ?? null,
    };
  }

  async collectLicenseEvidence(
    repository: RepositoryMetadata,
    commit: string,
    claim: string | undefined,
    artifactText: string | null,
  ): Promise<LicenseEvidence> {
    let repositoryLevel: LicenseEvidence["repository_level"];
    const licenseUrl = `${githubApi}/repos/${encodeURIComponent(repository.identity.owner)}/${encodeURIComponent(repository.identity.name)}/license?ref=${commit}`;
    try {
      const data = await this.requestJson(licenseUrl, "license.not_found");
      const license = data.license && typeof data.license === "object" && !Array.isArray(data.license)
        ? data.license as Record<string, unknown>
        : {};
      const spdxId = safeString(license.spdx_id);
      const status = !spdxId || ["NOASSERTION", "OTHER"].includes(spdxId.toUpperCase())
        ? "ambiguous"
        : "found";
      repositoryLevel = {
        status,
        spdx_id: spdxId,
        name: safeString(license.name),
        path: safeString(data.path),
        git_blob_sha: safeString(data.sha),
        evidence_url: safeString(data.html_url),
        scope: "repository-level",
        limitations: [
          "Repository-level license evidence is not automatically file-level licensing.",
          "GitHub license detection does not prove ownership, authorship, or legal permission.",
        ],
      };
    } catch (error) {
      const missing = error instanceof IntakeSourceError && error.code === "license.not_found";
      repositoryLevel = {
        status: missing ? "missing" : "unavailable",
        spdx_id: null,
        name: null,
        path: null,
        git_blob_sha: null,
        evidence_url: null,
        scope: "repository-level",
        limitations: [
          missing
            ? "No repository license file was reported by the GitHub License API at the pinned commit."
            : "Repository license evidence could not be retrieved.",
          "A submitter's license claim is not independent license evidence.",
        ],
      };
    }

    return {
      submission_claim: claim ?? null,
      repository_level: repositoryLevel,
      file_level: fileLevelEvidence(artifactText),
      limitations: [
        "Automated collection records public evidence; human legal and provenance review remains required.",
        "No license finding authorizes publication by the intake CLI.",
      ],
    };
  }
}

export type { RepositoryMetadata, ResolvedRef };
