import type {
  DiscoveryAdapter,
  DiscoveryCandidate,
  DiscoveryPlatform,
  DiscoveryReport,
  DiscoveryRunResult,
  DiscoverySource,
  DiscoverySourceError,
  DiscoverySourceEvidence,
  DiscoveryWarning,
  EvidenceReference,
  IntakeManifest,
  IntakeSubmission,
  SkippedDiscoveryResult,
} from "./types.js";
import { GitHubApiError } from "./github.js";

export class DiscoveryConfigurationError extends Error {}

export interface RunDiscoveryOptions {
  limit: number;
  discoveredAt: string;
  sourceIds?: string[];
  platforms?: DiscoveryPlatform[];
  githubAuthenticated: boolean;
}

function stableUnique<T>(values: T[], key: (value: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const value of values) byKey.set(key(value), value);
  return [...byKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([, value]) => value);
}

function stableWarnings(warnings: DiscoveryWarning[]): DiscoveryWarning[] {
  return stableUnique(warnings, (value) => `${value.code}\u0000${value.message}`);
}

function stableEvidence(evidence: EvidenceReference[]): EvidenceReference[] {
  return stableUnique(evidence, (value) => `${value.kind}\u0000${value.url}`);
}

function stableSources(sources: DiscoverySourceEvidence[]): DiscoverySourceEvidence[] {
  return stableUnique(sources, (value) => `${value.source_id}\u0000${value.adapter}\u0000${value.evidence_url}`);
}

function candidateCore(candidate: DiscoveryCandidate): string {
  const copy = {
    ...candidate,
    discovery_sources: [],
    provenance: [],
    warnings: [],
  };
  return JSON.stringify(copy);
}

export function deduplicateCandidates(
  rawCandidates: DiscoveryCandidate[],
): { candidates: DiscoveryCandidate[]; duplicateCount: number } {
  const deduplicated = new Map<string, DiscoveryCandidate>();
  for (const observation of [...rawCandidates].sort((left, right) => (
    `${left.dedupe_identity}:${left.discovery_sources[0]?.source_id ?? ""}`
      .localeCompare(`${right.dedupe_identity}:${right.discovery_sources[0]?.source_id ?? ""}`, "en")
  ))) {
    const existing = deduplicated.get(observation.dedupe_identity);
    if (!existing) {
      deduplicated.set(observation.dedupe_identity, {
        ...observation,
        discovery_sources: stableSources(observation.discovery_sources),
        provenance: stableEvidence(observation.provenance),
        warnings: stableWarnings(observation.warnings),
      });
      continue;
    }

    const coreConflict = candidateCore(existing) !== candidateCore(observation);
    const preferred = candidateCore(existing).localeCompare(candidateCore(observation), "en") <= 0
      ? existing
      : observation;
    deduplicated.set(observation.dedupe_identity, {
      ...preferred,
      discovery_sources: stableSources([
        ...existing.discovery_sources,
        ...observation.discovery_sources,
      ]),
      provenance: stableEvidence([...existing.provenance, ...observation.provenance]),
      warnings: stableWarnings([
        ...existing.warnings,
        ...observation.warnings,
        ...(coreConflict ? [{
          code: "duplicate_identity_metadata_conflict",
          message: "Repeated discovery returned different descriptive metadata for the same immutable artifact identity.",
        }] : []),
      ]),
    });
  }
  return {
    candidates: [...deduplicated.values()].sort((left, right) => (
      left.dedupe_identity.localeCompare(right.dedupe_identity, "en")
    )),
    duplicateCount: rawCandidates.length - deduplicated.size,
  };
}

export function isIntakeReady(candidate: DiscoveryCandidate): boolean {
  return candidate.source_type === "repository"
    && candidate.repository.visibility === "public"
    && /^https:\/\/github\.com\/[^/?#]+\/[^/?#]+$/.test(candidate.repository.url)
    && /^[0-9a-f]{40}$/.test(candidate.immutable_ref.commit)
    && candidate.artifact.path.length > 0
    && candidate.artifact.path.length <= 1_000
    && !candidate.artifact.path.startsWith("/")
    && !candidate.artifact.path.includes("\\")
    && !candidate.artifact.path.includes("?")
    && !candidate.artifact.path.includes("#")
    && candidate.title.length > 0
    && candidate.title.length <= 200;
}

export function toIntakeSubmission(candidate: DiscoveryCandidate): IntakeSubmission {
  if (!isIntakeReady(candidate)) {
    throw new DiscoveryConfigurationError(`Candidate ${candidate.candidate_id} is not Intake-ready.`);
  }
  const owner = candidate.repository_owner_evidence?.value ?? "unknown";
  return {
    record_version: "1.0",
    submission_id: candidate.candidate_id,
    repository_url: candidate.repository.url,
    artifact_path: candidate.artifact.path,
    commit: candidate.immutable_ref.commit,
    platform_hint: candidate.platform,
    workflow_name: candidate.title,
    description: `Public ${candidate.platform} Workflow artifact discovered at ${candidate.artifact.path} in ${candidate.repository.owner}/${candidate.repository.name}.`,
    submitter: {
      name_or_handle: "Weft Place Discovery",
      claims_authorship: false,
    },
    notes: [
      `Discovery candidate: ${candidate.candidate_id}.`,
      `Exact source: ${candidate.artifact.blob_url}.`,
      `Repository owner evidence: ${owner}; repository ownership does not establish artifact authorship.`,
      "Discovery made no Listing, safety, runtime, compatibility, quality, production-readiness, or recommendation claim.",
    ].join(" "),
  };
}

export function createIntakeManifest(candidates: DiscoveryCandidate[]): IntakeManifest {
  return {
    manifest_version: "1.0",
    submissions: candidates
      .filter(isIntakeReady)
      .map(toIntakeSubmission)
      .sort((left, right) => left.submission_id.localeCompare(right.submission_id, "en")),
  };
}

function roundRobinBounded(
  candidatesBySource: DiscoveryCandidate[][],
  limit: number,
): DiscoveryCandidate[] {
  const selected: DiscoveryCandidate[] = [];
  for (let index = 0; selected.length < limit; index += 1) {
    let added = false;
    for (const sourceCandidates of candidatesBySource) {
      const candidate = sourceCandidates[index];
      if (candidate && selected.length < limit) {
        selected.push(candidate);
        added = true;
      }
    }
    if (!added) break;
  }
  return selected;
}

function sourceError(source: DiscoverySource, caught: unknown): DiscoverySourceError {
  if (caught instanceof GitHubApiError) {
    return { source_id: source.source_id, code: caught.code, message: caught.message };
  }
  return {
    source_id: source.source_id,
    code: "adapter_error",
    message: "The Discovery adapter failed safely without producing candidates for this source.",
  };
}

function sortedSkipped(skipped: SkippedDiscoveryResult[]): SkippedDiscoveryResult[] {
  return [...skipped].sort((left, right) => (
    `${left.source_id}:${left.artifact_path ?? ""}:${left.reason}:${left.detail}`
      .localeCompare(`${right.source_id}:${right.artifact_path ?? ""}:${right.reason}:${right.detail}`, "en")
  ));
}

function countBy(values: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right, "en")));
}

function validateOptions(options: RunDiscoveryOptions): void {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new DiscoveryConfigurationError("Discovery limit must be an integer from 1 through 100.");
  }
  if (Number.isNaN(Date.parse(options.discoveredAt))) {
    throw new DiscoveryConfigurationError("discoveredAt must be a valid timestamp.");
  }
}

export async function runDiscovery(
  options: RunDiscoveryOptions,
  sources: DiscoverySource[],
  adapters: DiscoveryAdapter[],
): Promise<DiscoveryRunResult> {
  validateOptions(options);
  const sourceIdFilter = new Set(options.sourceIds ?? []);
  const platformFilter = new Set(options.platforms ?? []);
  const selectedSources = [...sources]
    .filter((source) => sourceIdFilter.size === 0 || sourceIdFilter.has(source.source_id))
    .filter((source) => platformFilter.size === 0 || platformFilter.has(source.platform))
    .sort((left, right) => left.source_id.localeCompare(right.source_id, "en"));
  if (selectedSources.length === 0) {
    throw new DiscoveryConfigurationError("No configured Discovery source matched the requested filters.");
  }
  if (sourceIdFilter.size > 0) {
    const known = new Set(sources.map((source) => source.source_id));
    const unknown = [...sourceIdFilter].filter((sourceId) => !known.has(sourceId)).sort();
    if (unknown.length > 0) {
      throw new DiscoveryConfigurationError(`Unknown Discovery source: ${unknown.join(", ")}.`);
    }
  }

  const adapterById = new Map(adapters.map((adapter) => [adapter.adapterId, adapter]));
  const results = await Promise.all(selectedSources.map(async (source) => {
    const adapter = adapterById.get(source.adapter);
    if (!adapter) {
      return {
        source,
        result: null,
        error: {
          source_id: source.source_id,
          code: "adapter_not_configured",
          message: `No adapter was configured for ${source.adapter}.`,
        } satisfies DiscoverySourceError,
      };
    }
    try {
      return {
        source,
        result: await adapter.discover(source, { discoveredAt: options.discoveredAt }),
        error: null,
      };
    } catch (caught) {
      return { source, result: null, error: sourceError(source, caught) };
    }
  }));

  const rawCandidates = roundRobinBounded(
    results.map(({ result }) => result?.candidates ?? []),
    options.limit,
  );
  const { candidates, duplicateCount } = deduplicateCandidates(rawCandidates);
  const skipped = sortedSkipped(results.flatMap(({ result }) => result?.skipped ?? []));
  const sourceErrors = results
    .flatMap(({ error }) => error ? [error] : [])
    .sort((left, right) => left.source_id.localeCompare(right.source_id, "en"));
  const intakeManifest = createIntakeManifest(candidates);
  const skipCounts = countBy(skipped.map((item) => item.reason));
  const report: DiscoveryReport = {
    report_version: "1.0",
    discovered_at: options.discoveredAt,
    requested_limit: options.limit,
    selected_sources: selectedSources.map((source) => source.source_id),
    selected_platforms: [...new Set(selectedSources.map((source) => source.platform))]
      .sort((left, right) => left.localeCompare(right, "en")),
    github_authentication: options.githubAuthenticated ? "authenticated" : "unauthenticated",
    raw_candidate_count: rawCandidates.length,
    unique_candidate_count: candidates.length,
    duplicate_count: duplicateCount,
    platform_distribution: countBy(candidates.map((candidate) => candidate.platform)),
    source_distribution: countBy(candidates.flatMap((candidate) => (
      candidate.discovery_sources.map((source) => source.source_id)
    ))),
    immutable_version_resolved_count: candidates.filter((candidate) => (
      /^[0-9a-f]{40}$/.test(candidate.immutable_ref.commit)
    )).length,
    identifiable_license_evidence_count: candidates.filter((candidate) => (
      candidate.license_evidence.status === "found"
      && candidate.license_evidence.spdx_id !== null
      && candidate.license_evidence.evidence_url !== null
    )).length,
    intake_ready_count: intakeManifest.submissions.length,
    skipped_count: skipped.length,
    skip_reasons: Object.entries(skipCounts).map(([reason, count]) => ({ reason, count })),
    skipped,
    source_errors: sourceErrors,
    claims: {
      listed: false,
      runtime_tested: false,
      compatibility_verified: false,
      workflows_executed: false,
    },
  };
  return { candidates, intake_manifest: intakeManifest, report };
}
