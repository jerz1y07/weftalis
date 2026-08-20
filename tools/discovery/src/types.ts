export type DiscoveryPlatform = "dify" | "n8n" | "unknown";
export type ArtifactFormat = "dify_yaml" | "n8n_json" | "unknown";

export interface DiscoverySource {
  source_id: string;
  label: string;
  adapter: string;
  platform: DiscoveryPlatform;
  configuration: Record<string, unknown>;
}

export interface DiscoverySourceEvidence {
  source_id: string;
  adapter: string;
  evidence_url: string;
}

export interface EvidenceReference {
  kind: "repository" | "commit" | "artifact" | "license";
  url: string;
}

export interface DiscoveryWarning {
  code: string;
  message: string;
}

export interface DiscoveryCandidate {
  record_version: "1.0";
  candidate_id: string;
  dedupe_identity: string;
  source_type: "repository";
  platform: DiscoveryPlatform;
  title: string;
  repository: {
    url: string;
    owner: string;
    name: string;
    visibility: "public";
    archived: boolean;
  };
  repository_owner_evidence: {
    value: string;
    basis: "repository_owner";
    evidence_url: string;
    limitation: string;
  } | null;
  immutable_ref: {
    kind: "commit";
    commit: string;
    default_branch: string;
  };
  artifact: {
    path: string;
    format: ArtifactFormat;
    blob_url: string;
    raw_url: string;
    git_blob_sha: string | null;
    byte_size: number | null;
  };
  license_evidence: {
    status: "found" | "missing" | "ambiguous" | "unavailable";
    spdx_id: string | null;
    name: string | null;
    path: string | null;
    evidence_url: string | null;
    scope: "repository-level";
    limitation: string;
  };
  discovery_sources: DiscoverySourceEvidence[];
  discovered_at: string;
  provenance: EvidenceReference[];
  warnings: DiscoveryWarning[];
}

export interface SkippedDiscoveryResult {
  source_id: string;
  artifact_path: string | null;
  reason: string;
  detail: string;
}

export interface DiscoverySourceError {
  source_id: string;
  code: string;
  message: string;
}

export interface AdapterDiscoveryContext {
  discoveredAt: string;
}

export interface AdapterDiscoveryResult {
  candidates: DiscoveryCandidate[];
  skipped: SkippedDiscoveryResult[];
}

export interface DiscoveryAdapter {
  readonly adapterId: string;
  discover(
    source: DiscoverySource,
    context: AdapterDiscoveryContext,
  ): Promise<AdapterDiscoveryResult>;
}

export interface IntakeSubmission {
  record_version: "1.0";
  submission_id: string;
  repository_url: string;
  artifact_path: string;
  commit: string;
  platform_hint: DiscoveryPlatform;
  workflow_name: string;
  description: string;
  submitter: {
    name_or_handle: string;
    claims_authorship: false;
  };
  notes: string;
}

export interface IntakeManifest {
  manifest_version: "1.0";
  submissions: IntakeSubmission[];
}

export interface DiscoveryReport {
  report_version: "1.0";
  discovered_at: string;
  requested_limit: number;
  selected_sources: string[];
  selected_platforms: DiscoveryPlatform[];
  github_authentication: "authenticated" | "unauthenticated";
  raw_candidate_count: number;
  unique_candidate_count: number;
  duplicate_count: number;
  platform_distribution: Record<string, number>;
  source_distribution: Record<string, number>;
  immutable_version_resolved_count: number;
  identifiable_license_evidence_count: number;
  intake_ready_count: number;
  skipped_count: number;
  skip_reasons: Array<{ reason: string; count: number }>;
  skipped: SkippedDiscoveryResult[];
  source_errors: DiscoverySourceError[];
  claims: {
    listed: false;
    runtime_tested: false;
    compatibility_verified: false;
    workflows_executed: false;
  };
}

export interface DiscoveryRunResult {
  candidates: DiscoveryCandidate[];
  intake_manifest: IntakeManifest;
  report: DiscoveryReport;
}
