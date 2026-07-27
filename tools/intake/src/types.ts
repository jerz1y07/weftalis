export type Platform = "dify" | "n8n" | "unknown";

export interface CommunitySubmission {
  record_version: "1.0";
  submission_id?: string;
  repository_url: string;
  artifact_path: string;
  branch?: string;
  tag?: string;
  commit?: string;
  platform_hint?: Platform;
  workflow_name: string;
  description: string;
  submitter: {
    name_or_handle: string;
    claims_authorship: boolean;
  };
  upstream_author_or_organization?: string;
  license_claim?: string;
  notes?: string;
}

export interface SubmissionManifest {
  manifest_version: "1.0";
  submissions: CommunitySubmission[];
}

export type RequestedRefKind = "branch" | "tag" | "commit" | "default_branch";

export interface LicenseEvidence {
  submission_claim: string | null;
  repository_level: {
    status: "found" | "missing" | "ambiguous" | "unavailable";
    spdx_id: string | null;
    name: string | null;
    path: string | null;
    git_blob_sha: string | null;
    evidence_url: string | null;
    scope: "repository-level";
    limitations: string[];
  };
  file_level: {
    status: "found" | "missing" | "ambiguous" | "not_scanned";
    spdx_identifiers: string[];
    method: string;
    limitations: string[];
  };
  limitations: string[];
}

export interface ArtifactFingerprint {
  sha256: string;
  byte_size: number;
  line_count: number;
  git_blob_sha_reported: string | null;
  git_blob_sha_calculated: string;
  git_blob_sha_matches: boolean | null;
  stored_artifact_sha256: string | null;
  stored_artifact_matches_fetched: boolean | null;
}

export interface ResolvedUpstreamArtifact {
  record_version: "1.0";
  resolution_status: "resolved" | "failed";
  repository: {
    submitted_url: string;
    normalized_url: string;
    owner: string;
    name: string;
  };
  requested_ref: {
    kind: RequestedRefKind;
    value: string | null;
    was_mutable: boolean;
  };
  resolved_commit: string | null;
  artifact: {
    requested_path: string;
    verified_case_sensitive_path: string | null;
    contents_api_url: string | null;
    raw_url: string | null;
    stored_path: string | null;
  };
  fingerprint: ArtifactFingerprint | null;
  retrieved_at: string | null;
  license_evidence: LicenseEvidence;
  failure: { code: string; message: string } | null;
  warnings: string[];
}

export interface AuditNode {
  id: string | null;
  name: string | null;
  type: string | null;
}

export interface AuditSignal {
  category: string;
  node_name: string | null;
  node_type: string | null;
  location: string | null;
  detail: string;
}

export interface StaticSignals {
  code_execution: AuditSignal[];
  shell_execution: AuditSignal[];
  model_or_llm: AuditSignal[];
  provider_references: AuditSignal[];
  credential_references: AuditSignal[];
  environment_variable_references: AuditSignal[];
  http_or_network: AuditSignal[];
  external_writes: AuditSignal[];
  webhooks_or_triggers: AuditSignal[];
  required_plugins_or_custom_nodes: AuditSignal[];
  human_review_or_approval: AuditSignal[];
  hard_coded_identifiers: AuditSignal[];
}

export interface SecretFinding {
  kind: string;
  line: number | null;
  redacted_preview: string;
}

export interface RiskItem {
  status: "detected" | "not_detected" | "unknown";
  evidence: string[];
  caution: string;
}

export interface StaticAuditResult {
  record_version: "1.0";
  artifact_available: boolean;
  platform: Platform;
  parsing_status: "parsed" | "needs_review";
  application_or_workflow_type: string | null;
  schema_indicators: string[];
  nodes: AuditNode[];
  node_count: number | null;
  edge_count: number | null;
  signals: StaticSignals;
  dependencies: {
    providers: string[];
    models: string[];
    plugins: string[];
    custom_nodes: string[];
    other: string[];
  };
  secret_scan: {
    status: "none_detected" | "potential_values_detected" | "not_scanned";
    finding_count: number;
    findings: SecretFinding[];
    limitations: string[];
  };
  risk_summary: {
    code_execution: RiskItem;
    shell_execution: RiskItem;
    network_access: RiskItem;
    credential_requirements: RiskItem;
    external_writes: RiskItem;
    personal_or_hard_coded_identifiers: RiskItem;
    secret_scan_results: RiskItem;
    dependency_declarations: RiskItem;
  };
  runtime_status: "untested";
  compatibility_status: "unverified";
  recommended_moderation_status: "needs_review" | "quarantined" | "rejected";
  warnings: string[];
  uncertainties: string[];
  limitations: string[];
}

export type ModerationState =
  | "submitted"
  | "resolving"
  | "fetched"
  | "parsed"
  | "needs_review"
  | "approved"
  | "rejected"
  | "quarantined";

export interface ModerationStatus {
  record_version: "1.0";
  current_status: ModerationState;
  automatic_publication: false;
  history: Array<{
    status: ModerationState;
    at: string;
    actor: "intake-cli" | "human-reviewer";
    reason: string;
  }>;
  human_decision: {
    reviewer: string;
    reviewed_at: string;
    rationale: string;
  } | null;
}

export interface DuplicateStatus {
  duplicate_artifact: boolean;
  artifact_matches: string[];
  duplicate_source: boolean;
  source_matches: string[];
}

export interface ReviewRecord {
  record_version: "1.0";
  review_id: string;
  created_at: string;
  original_submission: CommunitySubmission;
  resolved_artifact: ResolvedUpstreamArtifact;
  static_audit: StaticAuditResult;
  duplicate_status: DuplicateStatus;
  moderation: ModerationStatus;
  warnings: string[];
  uncertainties: string[];
}

export interface RepositoryIdentity {
  submittedUrl: string;
  normalizedUrl: string;
  owner: string;
  name: string;
}

export interface RetrievedArtifact {
  bytes: Uint8Array;
  verifiedPath: string;
  contentsApiUrl: string;
  rawUrl: string;
  reportedGitBlobSha: string | null;
}

export interface ExistingReviewIndexEntry {
  reviewId: string;
  sha256: string | null;
  normalizedRepository: string;
  artifactPath: string;
  commit: string | null;
}
