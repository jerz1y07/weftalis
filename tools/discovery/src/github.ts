import { createHash } from "node:crypto";

import {
  isGitHubRepositoryTreeConfiguration,
  type GitHubRepositoryTreeConfiguration,
} from "./sources.js";
import type {
  AdapterDiscoveryContext,
  AdapterDiscoveryResult,
  ArtifactFormat,
  DiscoveryAdapter,
  DiscoveryCandidate,
  DiscoverySource,
  DiscoveryWarning,
  EvidenceReference,
  SkippedDiscoveryResult,
} from "./types.js";

type JsonRecord = Record<string, unknown>;
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class GitHubApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

export interface GitHubClientOptions {
  token?: string;
  fetchImpl?: FetchLike;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function encodePath(path: string): string {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function isSafeRepositoryPath(value: string): boolean {
  return value.length > 0
    && !value.startsWith("/")
    && !value.includes("\\")
    && !value.includes("?")
    && !value.includes("#")
    && value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function normalizeTitle(path: string): string {
  const filename = path.split("/").at(-1) ?? path;
  const withoutExtension = filename.replace(/\.(?:json|ya?ml)$/i, "");
  const normalized = withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized || filename;
}

function artifactFormat(platform: DiscoverySource["platform"], path: string): ArtifactFormat {
  if (platform === "n8n" && path.toLowerCase().endsWith(".json")) return "n8n_json";
  if (platform === "dify" && /\.ya?ml$/i.test(path)) return "dify_yaml";
  return "unknown";
}

function warning(code: string, message: string): DiscoveryWarning {
  return { code, message };
}

export function githubTokenFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  for (const name of ["GITHUB_TOKEN", "GH_TOKEN"]) {
    const value = environment[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function githubCandidateIdentity(
  owner: string,
  repository: string,
  commit: string,
  artifactPath: string,
): string {
  return `github:${owner.toLowerCase()}/${repository.toLowerCase()}@${commit.toLowerCase()}:${artifactPath}`;
}

function candidateId(identity: string): string {
  return `disc-${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
}

export class GitHubClient {
  private readonly token?: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token?.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getJson(path: string): Promise<unknown> {
    if (!path.startsWith("/repos/") || path.includes("\\")) {
      throw new GitHubApiError("invalid_request", null, "GitHub request path was rejected.");
    }
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "weft-place-discovery-v1",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await this.fetchImpl(`https://api.github.com${path}`, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new GitHubApiError("github_network_error", null, "GitHub could not be reached.");
    }

    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (response.status === 429 || (response.status === 403 && remaining === "0")) {
        const reset = response.headers.get("x-ratelimit-reset");
        const suffix = reset ? ` Reset epoch: ${reset}.` : "";
        throw new GitHubApiError(
          "github_rate_limit",
          response.status,
          `GitHub API rate limit prevented discovery.${suffix}`,
        );
      }
      throw new GitHubApiError(
        response.status === 404 ? "github_not_found" : "github_api_error",
        response.status,
        `GitHub API request failed with status ${response.status}.`,
      );
    }

    try {
      return await response.json() as unknown;
    } catch {
      throw new GitHubApiError(
        "malformed_github_response",
        response.status,
        "GitHub returned malformed JSON.",
      );
    }
  }
}

interface RepositoryDetails {
  owner: string;
  name: string;
  defaultBranch: string;
  repositoryUrl: string;
  archived: boolean;
}

interface RepositoryLicense {
  evidence: DiscoveryCandidate["license_evidence"];
  warnings: DiscoveryWarning[];
}

function parseRepository(value: unknown, expectedOwner: string, expectedName: string): RepositoryDetails {
  if (!isRecord(value)
    || value.private !== false
    || value.visibility !== "public"
    || typeof value.name !== "string"
    || !isRecord(value.owner)
    || typeof value.owner.login !== "string"
    || typeof value.default_branch !== "string"
    || typeof value.archived !== "boolean") {
    throw new GitHubApiError(
      "malformed_repository",
      null,
      "GitHub repository metadata was incomplete or did not establish public visibility.",
    );
  }
  if (value.owner.login.toLowerCase() !== expectedOwner.toLowerCase()
    || value.name.toLowerCase() !== expectedName.toLowerCase()) {
    throw new GitHubApiError(
      "repository_identity_mismatch",
      null,
      "GitHub repository identity did not match the configured source.",
    );
  }
  return {
    owner: value.owner.login,
    name: value.name,
    defaultBranch: value.default_branch,
    repositoryUrl: `https://github.com/${value.owner.login}/${value.name}`,
    archived: value.archived,
  };
}

function parseCommit(value: unknown): string {
  if (!isRecord(value) || typeof value.sha !== "string" || !/^[0-9a-f]{40}$/.test(value.sha)) {
    throw new GitHubApiError(
      "malformed_commit",
      null,
      "GitHub did not return a full immutable commit for the source.",
    );
  }
  return value.sha;
}

async function discoverLicense(
  client: GitHubClient,
  repository: RepositoryDetails,
  commit: string,
): Promise<RepositoryLicense> {
  const limitation = "Repository-level license evidence may not apply to this artifact.";
  try {
    const value = await client.getJson(
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/license?ref=${commit}`,
    );
    if (!isRecord(value) || !isRecord(value.license)) {
      return {
        evidence: {
          status: "ambiguous",
          spdx_id: null,
          name: null,
          path: null,
          evidence_url: null,
          scope: "repository-level",
          limitation,
        },
        warnings: [warning("license_evidence_ambiguous", "GitHub returned incomplete repository-level license evidence.")],
      };
    }
    const spdx = typeof value.license.spdx_id === "string" ? value.license.spdx_id : null;
    const name = typeof value.license.name === "string" ? value.license.name : null;
    const licensePath = typeof value.path === "string" && isSafeRepositoryPath(value.path) ? value.path : null;
    const evidenceUrl = licensePath
      ? `${repository.repositoryUrl}/blob/${commit}/${encodePath(licensePath)}`
      : null;
    const status = spdx && spdx !== "NOASSERTION" && licensePath ? "found" : "ambiguous";
    return {
      evidence: {
        status,
        spdx_id: spdx === "NOASSERTION" ? null : spdx,
        name,
        path: licensePath,
        evidence_url: evidenceUrl,
        scope: "repository-level",
        limitation,
      },
      warnings: status === "found"
        ? [warning("repository_license_scope_only", limitation)]
        : [warning("license_evidence_ambiguous", "Repository-level license evidence did not identify a pinned SPDX license file.")],
    };
  } catch (caught) {
    if (caught instanceof GitHubApiError && caught.status === 404) {
      return {
        evidence: {
          status: "missing",
          spdx_id: null,
          name: null,
          path: null,
          evidence_url: null,
          scope: "repository-level",
          limitation,
        },
        warnings: [warning("license_evidence_missing", "GitHub did not expose repository-level license evidence at the pinned commit.")],
      };
    }
    return {
      evidence: {
        status: "unavailable",
        spdx_id: null,
        name: null,
        path: null,
        evidence_url: null,
        scope: "repository-level",
        limitation,
      },
      warnings: [warning("license_evidence_unavailable", "Repository-level license evidence could not be retrieved during Discovery.")],
    };
  }
}

function matchesArtifact(
  configuration: GitHubRepositoryTreeConfiguration,
  artifactPath: string,
): boolean {
  const lower = artifactPath.toLowerCase();
  return configuration.include_path_prefixes.some((prefix) => artifactPath.startsWith(prefix))
    && configuration.artifact_extensions.some((extension) => lower.endsWith(extension));
}

export class GitHubRepositoryTreeAdapter implements DiscoveryAdapter {
  readonly adapterId = "github_repository_tree";

  constructor(private readonly client: GitHubClient) {}

  async discover(
    source: DiscoverySource,
    context: AdapterDiscoveryContext,
  ): Promise<AdapterDiscoveryResult> {
    if (source.adapter !== this.adapterId
      || !isGitHubRepositoryTreeConfiguration(source.configuration)) {
      throw new GitHubApiError(
        "invalid_source_configuration",
        null,
        `Discovery source ${source.source_id} is not a valid GitHub repository-tree source.`,
      );
    }
    const configuration = source.configuration;
    const repositoryPath = `/repos/${encodeURIComponent(configuration.owner)}/${encodeURIComponent(configuration.repository)}`;
    const repository = parseRepository(
      await this.client.getJson(repositoryPath),
      configuration.owner,
      configuration.repository,
    );
    const commit = parseCommit(await this.client.getJson(
      `${repositoryPath}/commits/${encodeURIComponent(repository.defaultBranch)}`,
    ));
    const treeValue = await this.client.getJson(`${repositoryPath}/git/trees/${commit}?recursive=1`);
    if (!isRecord(treeValue) || !Array.isArray(treeValue.tree) || typeof treeValue.truncated !== "boolean") {
      throw new GitHubApiError(
        "malformed_tree",
        null,
        "GitHub repository tree response was incomplete.",
      );
    }
    const repositoryLicense = await discoverLicense(this.client, repository, commit);
    const sharedWarnings = [
      warning(
        "repository_owner_not_artifact_author",
        "Repository ownership is evidence of repository control, not proof of artifact authorship.",
      ),
      ...repositoryLicense.warnings,
    ];
    if (repository.archived) {
      sharedWarnings.push(warning("repository_archived", "GitHub reports that the source repository is archived."));
    }
    if (treeValue.truncated) {
      sharedWarnings.push(warning("repository_tree_truncated", "GitHub reported a truncated repository tree; Discovery coverage may be incomplete."));
    }

    const candidates: DiscoveryCandidate[] = [];
    const skipped: SkippedDiscoveryResult[] = [];
    for (const entry of treeValue.tree) {
      if (!isRecord(entry)) {
        skipped.push({
          source_id: source.source_id,
          artifact_path: null,
          reason: "malformed_upstream_result",
          detail: "A GitHub tree entry was not an object.",
        });
        continue;
      }
      if (entry.type !== "blob") continue;
      if (typeof entry.path !== "string") {
        skipped.push({
          source_id: source.source_id,
          artifact_path: null,
          reason: "malformed_upstream_result",
          detail: "A GitHub blob entry did not contain a path.",
        });
        continue;
      }
      if (!matchesArtifact(configuration, entry.path)) continue;
      if (!isSafeRepositoryPath(entry.path)) {
        skipped.push({
          source_id: source.source_id,
          artifact_path: entry.path,
          reason: "invalid_artifact_path",
          detail: "The artifact path was not a safe repository-relative path.",
        });
        continue;
      }
      if ((typeof entry.sha !== "string" || !/^[0-9a-f]{40}$/.test(entry.sha))
        || (entry.size !== undefined && (!Number.isSafeInteger(entry.size) || Number(entry.size) <= 0))) {
        skipped.push({
          source_id: source.source_id,
          artifact_path: entry.path,
          reason: "malformed_upstream_result",
          detail: "The matching GitHub blob entry lacked a valid blob identity or size.",
        });
        continue;
      }

      const identity = githubCandidateIdentity(repository.owner, repository.name, commit, entry.path);
      const blobUrl = `${repository.repositoryUrl}/blob/${commit}/${encodePath(entry.path)}`;
      const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/${commit}/${encodePath(entry.path)}`;
      const provenance: EvidenceReference[] = [
        { kind: "repository" as const, url: repository.repositoryUrl },
        { kind: "commit" as const, url: `${repository.repositoryUrl}/commit/${commit}` },
        { kind: "artifact" as const, url: blobUrl },
      ];
      if (repositoryLicense.evidence.evidence_url) {
        provenance.push({ kind: "license", url: repositoryLicense.evidence.evidence_url });
      }
      candidates.push({
        record_version: "1.0",
        candidate_id: candidateId(identity),
        dedupe_identity: identity,
        source_type: "repository",
        platform: source.platform,
        title: normalizeTitle(entry.path),
        repository: {
          url: repository.repositoryUrl,
          owner: repository.owner,
          name: repository.name,
          visibility: "public",
          archived: repository.archived,
        },
        repository_owner_evidence: {
          value: repository.owner,
          basis: "repository_owner",
          evidence_url: `https://github.com/${encodeURIComponent(repository.owner)}`,
          limitation: "Repository ownership does not establish artifact authorship.",
        },
        immutable_ref: {
          kind: "commit",
          commit,
          default_branch: repository.defaultBranch,
        },
        artifact: {
          path: entry.path,
          format: artifactFormat(source.platform, entry.path),
          blob_url: blobUrl,
          raw_url: rawUrl,
          git_blob_sha: entry.sha,
          byte_size: typeof entry.size === "number" ? entry.size : null,
        },
        license_evidence: repositoryLicense.evidence,
        discovery_sources: [{
          source_id: source.source_id,
          adapter: this.adapterId,
          evidence_url: `https://api.github.com${repositoryPath}/git/trees/${commit}?recursive=1`,
        }],
        discovered_at: context.discoveredAt,
        provenance,
        warnings: [...sharedWarnings],
      });
    }

    return {
      candidates: candidates.sort((left, right) => left.dedupe_identity.localeCompare(right.dedupe_identity, "en")),
      skipped: skipped.sort((left, right) => (
        `${left.source_id}:${left.artifact_path ?? ""}:${left.reason}`
          .localeCompare(`${right.source_id}:${right.artifact_path ?? ""}:${right.reason}`, "en")
      )),
    };
  }
}
