export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  file?: string;
  line?: number;
}

export interface ValidationReport {
  packageRoot: string;
  manifestPath: string;
  valid: boolean;
  checks: Array<{ status: "passed" | "failed" | "warning"; label: string }>;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export interface WorkflowManifest {
  spec_version: "0.1";
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  repository?: string;
  license: string;
  runtime: {
    platform: "n8n" | "dify";
    minimum_version: string;
    source_file: string;
  };
  categories?: string[];
  tags?: string[];
  inputs: Array<{ name: string; type: string; required: boolean; description: string }>;
  outputs: Array<{ name: string; type: string; description: string }>;
  dependencies: { services: string[]; models: string[]; tools: string[] };
  permissions: {
    network_access: boolean;
    filesystem_read: boolean;
    filesystem_write: boolean;
    email_send: boolean;
    social_publish: boolean;
    code_execution: boolean;
    credential_access: boolean;
  };
  human_review: { required: boolean; checkpoints: string[] };
  safety: {
    stores_user_data: boolean;
    sends_data_externally: boolean;
    contains_credentials: boolean;
    risk_level: "low" | "medium" | "high";
  };
  testing?: {
    status: "untested" | "passed" | "failed";
    last_tested?: string;
    tested_platform_version?: string;
  };
  files: { readme: string; example_input?: string; example_output?: string };
}

export type ValidatePackage = (packagePath: string) => Promise<ValidationReport>;

export interface DiscoveredPackage {
  name: string;
  packageRoot: string;
  manifestPath: string;
}

export interface DiscoveryResult {
  packages: DiscoveredPackage[];
  ignoredTemplates: number;
  ignoredDirectories: number;
}

export type ListingAdmissionState =
  | "discovered"
  | "listed"
  | "needs_review"
  | "quarantined"
  | "removed";

export interface ListingClaims {
  discovered: boolean;
  listed: boolean;
  static_reviewed: boolean;
  runtime_tested: boolean;
  compatibility_verified: boolean;
  human_reviewed: boolean;
  featured: boolean;
  removed: boolean;
}

export interface RepositoryListingSource {
  source_type: "repository";
  repository_url: string;
  artifact_url: string | null;
  acquisition_url: string | null;
  artifact_path: string;
  immutable_ref: string | null;
  original_artifact_sha256: string | null;
  version: string | null;
}

export interface DirectUploadListingSource {
  source_type: "direct_upload";
  submitter: string | null;
  uploaded_at: string | null;
  original_artifact_sha256: string | null;
  declared_author: string | null;
  declared_license: string | null;
  acquisition_url: string | null;
}

export type PackageIndependentListingSource =
  | RepositoryListingSource
  | DirectUploadListingSource;

export interface AdmissionRiskSignals {
  credentials: "detected" | "not_detected" | "unknown";
  code_execution: "detected" | "not_detected" | "unknown";
  filesystem_writes: "detected" | "not_detected" | "unknown";
  destructive_actions: "detected" | "not_detected" | "unknown";
  external_publishing: "detected" | "not_detected" | "unknown";
  high_risk_network: "detected" | "not_detected" | "unknown";
  user_reports: "present" | "none" | "unknown";
}

export interface PackageIndependentAdmissionRecord {
  record_version: "1.0";
  id: string;
  title: string;
  summary: string;
  platform: string;
  categories: string[];
  tags: string[];
  original_creator: string | null;
  creator_evidence: string;
  listing_maintainer: string;
  license_expression: string;
  license_evidence: string;
  important_limitations: string[];
  use_steps: string[];
  source: PackageIndependentListingSource;
  evidence: {
    intake_review_id: string;
    intake_created_at: string;
    artifact_retrieved_at: string | null;
    provenance_status: "recorded" | "uncertain";
    source_resolution: "resolved" | "failed" | "not_applicable";
    artifact_integrity: "verified" | "failed";
    parsing_status: "parsed" | "failed" | "unsupported";
    structure_status: "plausible" | "uncertain";
    license_status: "no_clear_blocker" | "unclear" | "conflicting" | "blocked";
    secret_scan_status: "none_detected" | "potential_values_detected" | "confirmed_values_detected" | "not_scanned";
    malicious_content_status: "none_detected" | "suspected" | "not_assessed";
    transformation_status: "none" | "non_material" | "substantial" | "unknown";
    transformation_evidence: string;
    transformed_artifact: {
      sha256: string;
      owner: string;
      license: string;
    } | null;
    risk_signals: AdmissionRiskSignals;
    runtime_status: "untested" | "passed" | "failed";
    compatibility_status: "unverified" | "verified";
    evidence_references: string[];
    human_review: {
      status: "not_required" | "approved";
      evidence_reference: string | null;
      reviewer: string | null;
      reviewed_at: string | null;
      rationale: string | null;
    };
  };
}

export interface DiscoveredListingCandidate {
  name: string;
  recordPath: string;
}

export interface ListingDiscoveryResult {
  candidates: DiscoveredListingCandidate[];
  ignoredFiles: number;
}

export interface PublicIssue {
  code: string;
  message: string;
  file: string | null;
  line: number | null;
}

export interface RegistryEntry {
  id: string;
  name: string;
  version: string | null;
  description: string;
  author: string;
  license: string;
  platform: string;
  minimum_platform_version: string | null;
  categories: string[];
  tags: string[];
  inputs: WorkflowManifest["inputs"];
  outputs: WorkflowManifest["outputs"];
  permissions: WorkflowManifest["permissions"] | null;
  human_review: WorkflowManifest["human_review"] | null;
  safety: WorkflowManifest["safety"] | null;
  testing: WorkflowManifest["testing"] | null;
  package_path: string | null;
  source_file: string | null;
  readme_file: string | null;
  listing_source: "package" | "package_independent";
  listing: {
    state: "listed";
    original_creator: string | null;
    creator_evidence: string;
    listing_maintainer: string;
    source: PackageIndependentListingSource | {
      source_type: "package";
      repository_url: string | null;
      artifact_path: string;
    };
    acquisition_url: string | null;
    license_evidence: string;
    transformation_evidence: string;
    important_limitations: string[];
    use_steps: string[];
    provenance_reference: string;
  };
  claims: ListingClaims;
  validation: {
    status: "valid" | "admitted";
    errors: PublicIssue[];
    warnings: PublicIssue[];
    checked_at: string;
  };
}

export interface RegistryDocument {
  schema_version: "0.2";
  generated_at: string;
  workflow_count: number;
  workflows: RegistryEntry[];
}

export interface RejectedPackage {
  package_path: string;
  manifest_path: string;
  id: string | null;
  errors: PublicIssue[];
  warnings: PublicIssue[];
}

export interface EscalatedListing {
  record_path: string;
  id: string | null;
  admission_state: Exclude<ListingAdmissionState, "discovered" | "listed" | "removed">;
  reasons: PublicIssue[];
}

export interface RejectedDocument {
  schema_version: "0.2";
  generated_at: string;
  rejected_count: number;
  packages: RejectedPackage[];
  listings: EscalatedListing[];
}

export interface BuildResult {
  registry: RegistryDocument;
  rejected: RejectedDocument;
  discoveredCount: number;
  ignoredTemplates: number;
  ignoredDirectories: number;
  discoveredListingCount: number;
  escalatedListingCount: number;
}
