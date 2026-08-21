import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { toPosixRelative } from "./normalize-entry.js";
import type {
  AdmissionRiskSignals,
  DiscoveredListingCandidate,
  EscalatedListing,
  PackageIndependentAdmissionRecord,
  PackageIndependentListingSource,
  PublicIssue,
  RegistryEntry,
} from "./types.js";

export interface ListingAdmissionResult {
  recordPath: string;
  id: string | null;
  entry: RegistryEntry | null;
  escalation: EscalatedListing | null;
}

export interface AdmissionDecision {
  state: "listed" | "needs_review" | "quarantined";
  reasons: PublicIssue[];
}

type JsonRecord = Record<string, unknown>;

const idPattern = /^[a-z0-9][a-z0-9-]{0,127}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;
const signalValues = ["detected", "not_detected", "unknown"] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: JsonRecord, keys: string[]): boolean {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  const expected = [...keys].sort((left, right) => left.localeCompare(right, "en"));
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || (isNonEmptyString(value) && !Number.isNaN(Date.parse(value)));
}

function isNullableSha256(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && sha256Pattern.test(value));
}

function isStringArray(value: unknown, allowEmpty = true): value is string[] {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every(isNonEmptyString);
}

function isEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isHttpsUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "";
  } catch {
    return false;
  }
}

export function containsPotentialSecret(value: string): boolean {
  const patterns = [
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\b(?:password|api[_-]?key|token|secret)\s*[:=]\s*["']?[^\s"'#,;}]{8,}/i,
  ];
  return patterns.some((pattern) => pattern.test(value));
}

function isRelativeArtifactPath(value: unknown): value is string {
  if (!isNonEmptyString(value) || path.isAbsolute(value) || value.includes("\\")) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function githubRepositoryCoordinates(value: string): { owner: string; repository: string } | null {
  const parsed = new URL(value);
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (parsed.hostname.toLowerCase() !== "github.com"
    || parsed.port !== ""
    || parsed.search !== ""
    || parsed.hash !== ""
    || segments.length !== 2
    || !segments[0]
    || !segments[1]
    || segments[1].endsWith(".git")) return null;
  return { owner: segments[0], repository: segments[1] };
}

function repositoryUrlsMatchSource(value: JsonRecord): boolean {
  if (typeof value.repository_url !== "string"
    || typeof value.artifact_path !== "string"
    || typeof value.immutable_ref !== "string"
    || typeof value.artifact_url !== "string"
    || typeof value.acquisition_url !== "string") return false;
  const coordinates = githubRepositoryCoordinates(value.repository_url);
  if (!coordinates) return false;
  const encodedPath = value.artifact_path.split("/").map(encodeURIComponent).join("/");
  const repositoryBase = `https://github.com/${coordinates.owner}/${coordinates.repository}`;
  const expectedArtifactUrl = `${repositoryBase}/blob/${value.immutable_ref}/${encodedPath}`;
  const expectedRawUrl = `https://raw.githubusercontent.com/${coordinates.owner}/${coordinates.repository}/${value.immutable_ref}/${encodedPath}`;
  return value.repository_url === repositoryBase
    && value.artifact_url === expectedArtifactUrl
    && (value.acquisition_url === expectedArtifactUrl || value.acquisition_url === expectedRawUrl);
}

function isRepositorySource(value: unknown): value is PackageIndependentListingSource {
  if (!isRecord(value) || !hasExactKeys(value, [
    "source_type",
    "repository_url",
    "artifact_url",
    "acquisition_url",
    "artifact_path",
    "immutable_ref",
    "original_artifact_sha256",
    "version",
  ])) return false;

  return value.source_type === "repository"
    && isHttpsUrl(value.repository_url)
    && (value.artifact_url === null || isHttpsUrl(value.artifact_url))
    && (value.acquisition_url === null || isHttpsUrl(value.acquisition_url))
    && isRelativeArtifactPath(value.artifact_path)
    && (value.immutable_ref === null
      || (typeof value.immutable_ref === "string" && commitPattern.test(value.immutable_ref)))
    && isNullableSha256(value.original_artifact_sha256)
    && isNullableString(value.version)
    && (
      value.artifact_url === null
        && value.acquisition_url === null
        && value.immutable_ref === null
      || repositoryUrlsMatchSource(value)
    );
}

function isDirectUploadSource(value: unknown): value is PackageIndependentListingSource {
  if (!isRecord(value) || !hasExactKeys(value, [
    "source_type",
    "submitter",
    "uploaded_at",
    "original_artifact_sha256",
    "declared_author",
    "declared_license",
    "acquisition_url",
  ])) return false;

  return value.source_type === "direct_upload"
    && isNullableString(value.submitter)
    && isNullableDate(value.uploaded_at)
    && isNullableSha256(value.original_artifact_sha256)
    && isNullableString(value.declared_author)
    && isNullableString(value.declared_license)
    && (value.acquisition_url === null || isHttpsUrl(value.acquisition_url));
}

function isRiskSignals(value: unknown): value is AdmissionRiskSignals {
  if (!isRecord(value) || !hasExactKeys(value, [
    "credentials",
    "code_execution",
    "filesystem_writes",
    "destructive_actions",
    "external_publishing",
    "high_risk_network",
    "user_reports",
  ])) return false;

  return isEnum(value.credentials, signalValues)
    && isEnum(value.code_execution, signalValues)
    && isEnum(value.filesystem_writes, signalValues)
    && isEnum(value.destructive_actions, signalValues)
    && isEnum(value.external_publishing, signalValues)
    && isEnum(value.high_risk_network, signalValues)
    && isEnum(value.user_reports, ["present", "none", "unknown"] as const);
}

function isEvidence(value: unknown): value is PackageIndependentAdmissionRecord["evidence"] {
  if (!isRecord(value) || !hasExactKeys(value, [
    "intake_review_id",
    "intake_created_at",
    "artifact_retrieved_at",
    "provenance_status",
    "source_resolution",
    "artifact_integrity",
    "parsing_status",
    "structure_status",
    "license_status",
    "secret_scan_status",
    "malicious_content_status",
    "transformation_status",
    "transformation_evidence",
    "transformed_artifact",
    "risk_signals",
    "runtime_status",
    "compatibility_status",
    "evidence_references",
    "human_review",
  ])) return false;

  if (!isRecord(value.human_review) || !hasExactKeys(value.human_review, [
    "status",
    "evidence_reference",
    "reviewer",
    "reviewed_at",
    "rationale",
  ])) return false;

  const humanStatus = isEnum(value.human_review.status, ["not_required", "approved"] as const);
  const humanReference = value.human_review.evidence_reference;
  const reviewer = value.human_review.reviewer;
  const reviewedAt = value.human_review.reviewed_at;
  const rationale = value.human_review.rationale;
  const completeApproval = humanReference !== null
    && isNonEmptyString(reviewer)
    && isNonEmptyString(reviewedAt)
    && !Number.isNaN(Date.parse(reviewedAt))
    && isNonEmptyString(rationale);
  const noApprovalClaim = humanReference === null
    && reviewer === null
    && reviewedAt === null
    && rationale === null;

  const transformedArtifact = value.transformed_artifact;
  const validTransformedArtifact = transformedArtifact === null || (
    isRecord(transformedArtifact)
    && hasExactKeys(transformedArtifact, ["sha256", "owner", "license"])
    && typeof transformedArtifact.sha256 === "string"
    && sha256Pattern.test(transformedArtifact.sha256)
    && isNonEmptyString(transformedArtifact.owner)
    && isNonEmptyString(transformedArtifact.license)
  );

  return isNonEmptyString(value.intake_review_id)
    && isNonEmptyString(value.intake_created_at)
    && !Number.isNaN(Date.parse(value.intake_created_at))
    && isNullableDate(value.artifact_retrieved_at)
    && isEnum(value.provenance_status, ["recorded", "uncertain"] as const)
    && isEnum(value.source_resolution, ["resolved", "failed", "not_applicable"] as const)
    && isEnum(value.artifact_integrity, ["verified", "failed"] as const)
    && isEnum(value.parsing_status, ["parsed", "failed", "unsupported"] as const)
    && isEnum(value.structure_status, ["plausible", "uncertain"] as const)
    && isEnum(value.license_status, ["no_clear_blocker", "unclear", "conflicting", "blocked"] as const)
    && isEnum(value.secret_scan_status, [
      "none_detected",
      "potential_values_detected",
      "confirmed_values_detected",
      "not_scanned",
    ] as const)
    && isEnum(value.malicious_content_status, ["none_detected", "suspected", "not_assessed"] as const)
    && isEnum(value.transformation_status, ["none", "non_material", "substantial", "unknown"] as const)
    && isNonEmptyString(value.transformation_evidence)
    && validTransformedArtifact
    && (value.transformation_status === "none" ? transformedArtifact === null : true)
    && isRiskSignals(value.risk_signals)
    && isEnum(value.runtime_status, ["untested", "passed", "failed"] as const)
    && isEnum(value.compatibility_status, ["unverified", "verified"] as const)
    && isStringArray(value.evidence_references, false)
    && humanStatus
    && (humanReference === null || isNonEmptyString(humanReference))
    && (value.human_review.status === "approved" ? completeApproval : noApprovalClaim);
}

function parseAdmissionRecord(value: unknown): PackageIndependentAdmissionRecord | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "record_version",
    "id",
    "title",
    "summary",
    "platform",
    "categories",
    "tags",
    "original_creator",
    "creator_evidence",
    "listing_maintainer",
    "license_expression",
    "license_evidence",
    "important_limitations",
    "use_steps",
    "source",
    "evidence",
  ])) return null;

  return value.record_version === "1.0"
    && typeof value.id === "string"
    && idPattern.test(value.id)
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.summary)
    && isNonEmptyString(value.platform)
    && isStringArray(value.categories)
    && isStringArray(value.tags)
    && isNullableString(value.original_creator)
    && isNonEmptyString(value.creator_evidence)
    && isNonEmptyString(value.listing_maintainer)
    && isNonEmptyString(value.license_expression)
    && isNonEmptyString(value.license_evidence)
    && isStringArray(value.important_limitations, false)
    && isStringArray(value.use_steps, false)
    && (isRepositorySource(value.source) || isDirectUploadSource(value.source))
    && isEvidence(value.evidence)
    ? value as unknown as PackageIndependentAdmissionRecord
    : null;
}

function issue(code: string, message: string, recordPath: string): PublicIssue {
  return { code, message, file: recordPath, line: null };
}

async function evidenceReferenceExists(repositoryRoot: string, reference: string): Promise<boolean> {
  if (isHttpsUrl(reference)) return true;
  if (!isRelativeArtifactPath(reference)) return false;
  const root = path.resolve(repositoryRoot);
  const target = path.resolve(root, reference);
  const relative = path.relative(root, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`)) return false;
  try {
    let current = root;
    for (const segment of relative.split(path.sep)) {
      current = path.join(current, segment);
      if ((await lstat(current)).isSymbolicLink()) return false;
    }
    const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(target)]);
    const realRelative = path.relative(realRoot, realTarget);
    if (realRelative === "" || realRelative === ".." || realRelative.startsWith(`..${path.sep}`)) return false;
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

export async function admissionReferenceIssues(
  record: PackageIndependentAdmissionRecord,
  repositoryRoot: string,
  recordPath: string,
): Promise<PublicIssue[]> {
  const references = [...record.evidence.evidence_references];
  if (record.evidence.human_review.evidence_reference) {
    references.push(record.evidence.human_review.evidence_reference);
  }
  const uniqueReferences = [...new Set(references)];
  const results = await Promise.all(uniqueReferences.map(async (reference) => ({
    reference,
    exists: await evidenceReferenceExists(repositoryRoot, reference),
  })));
  return results
    .filter((result) => !result.exists)
    .map(() => issue(
      "admission.evidence-reference-unavailable",
      "An evidence reference is unavailable or escapes the repository boundary.",
      recordPath,
    ));
}

function quarantineReasons(
  record: PackageIndependentAdmissionRecord,
  recordPath: string,
): PublicIssue[] {
  const reasons: PublicIssue[] = [];
  if (record.evidence.source_resolution === "failed") {
    reasons.push(issue("admission.source-resolution-failed", "Source resolution failed.", recordPath));
  }
  if (record.source.source_type === "repository" && (
    record.source.immutable_ref === null
    || record.source.original_artifact_sha256 === null
    || record.source.artifact_url === null
    || record.source.acquisition_url === null
  )) {
    reasons.push(issue(
      "admission.repository-provenance-incomplete",
      "Repository artifact identity or immutable acquisition evidence is incomplete.",
      recordPath,
    ));
  }
  if (record.evidence.artifact_integrity === "failed") {
    reasons.push(issue("admission.artifact-integrity-failed", "Artifact integrity evidence failed.", recordPath));
  }
  if (record.source.source_type === "direct_upload" && record.source.original_artifact_sha256 === null) {
    reasons.push(issue(
      "admission.direct-upload-artifact-hash-missing",
      "Direct-upload artifact identity is missing and requires quarantine.",
      recordPath,
    ));
  }
  if (record.evidence.parsing_status === "failed") {
    reasons.push(issue("admission.parse-failed", "The artifact could not be parsed.", recordPath));
  }
  if (record.evidence.license_status === "blocked") {
    reasons.push(issue("admission.license-blocked", "License evidence contains a clear blocker.", recordPath));
  }
  if (record.evidence.secret_scan_status === "confirmed_values_detected") {
    reasons.push(issue("admission.confirmed-secret", "Confirmed secret or credential leakage requires quarantine.", recordPath));
  }
  if (record.evidence.malicious_content_status === "suspected") {
    reasons.push(issue("admission.suspected-malicious-content", "Suspected malicious content requires quarantine.", recordPath));
  }
  return reasons;
}

function reviewReasons(
  record: PackageIndependentAdmissionRecord,
  recordPath: string,
): PublicIssue[] {
  const reasons: PublicIssue[] = [];
  const add = (code: string, message: string) => reasons.push(issue(code, message, recordPath));

  if (record.evidence.provenance_status !== "recorded") add("admission.provenance-uncertain", "Provenance is uncertain.");
  if (record.source.source_type === "repository" && record.evidence.source_resolution !== "resolved") {
    add("admission.repository-source-unresolved", "Repository-backed evidence must resolve the exact source.");
  }
  if (record.source.source_type === "direct_upload" && record.evidence.source_resolution !== "not_applicable") {
    add("admission.direct-upload-source-mismatch", "Direct uploads must not invent repository resolution evidence.");
  }
  if (record.evidence.parsing_status === "unsupported") add("admission.parse-unsupported", "The artifact shape is unsupported.");
  if (record.evidence.structure_status !== "plausible") add("admission.structure-uncertain", "Basic workflow structure is uncertain.");
  if (["unclear", "conflicting"].includes(record.evidence.license_status)) {
    add("admission.license-needs-review", "License evidence is unclear or conflicting.");
  }
  if (record.evidence.secret_scan_status === "potential_values_detected") {
    add("admission.possible-secret-needs-review", "A heuristic secret-like finding requires evidence-based review.");
  }
  if (record.evidence.secret_scan_status === "not_scanned") add("admission.secret-scan-missing", "Secret screening evidence is missing.");
  if (["substantial", "unknown"].includes(record.evidence.transformation_status)) {
    add("admission.transformation-needs-review", "Substantial or uncertain transformation requires review.");
  }

  for (const [name, status] of Object.entries(record.evidence.risk_signals)) {
    const exceptionalCapability = [
      "filesystem_writes",
      "destructive_actions",
      "external_publishing",
      "high_risk_network",
    ].includes(name);
    if (name === "user_reports" && status === "present") {
      add("admission.risk.user_reports", "Recorded user reports require human escalation.");
    } else if (exceptionalCapability && status === "detected") {
      add(`admission.risk.${name}`, "A detected exceptional capability requires human escalation.");
    }
  }

  if (record.evidence.runtime_status !== "untested" || record.evidence.compatibility_status !== "unverified") {
    add("admission.higher-trust-claim", "Runtime or compatibility claims require human review evidence.");
  }
  return reasons;
}

function missingRequiredProvenanceReasons(
  record: PackageIndependentAdmissionRecord,
  recordPath: string,
): PublicIssue[] {
  if (record.source.source_type !== "direct_upload") return [];
  const reasons: PublicIssue[] = [];
  if (record.source.submitter === null || record.source.uploaded_at === null) {
    reasons.push(issue(
      "admission.direct-upload-provenance-incomplete",
      "Direct-upload submitter or upload timestamp is missing.",
      recordPath,
    ));
  }
  if (record.source.declared_author === null) {
    reasons.push(issue("admission.direct-upload-author-missing", "Direct-upload declared author evidence is missing.", recordPath));
  }
  if (record.source.declared_license === null) {
    reasons.push(issue("admission.direct-upload-license-missing", "Direct-upload declared license evidence is missing.", recordPath));
  }
  return reasons;
}

export function decideAdmissionRecord(
  record: PackageIndependentAdmissionRecord,
  recordPath: string,
): AdmissionDecision {
  const quarantine = quarantineReasons(record, recordPath);
  if (quarantine.length > 0) return { state: "quarantined", reasons: quarantine };

  const missingRequiredProvenance = missingRequiredProvenanceReasons(record, recordPath);
  if (missingRequiredProvenance.length > 0) {
    return { state: "needs_review", reasons: missingRequiredProvenance };
  }

  const review = reviewReasons(record, recordPath);
  if (review.length > 0 && record.evidence.human_review.status !== "approved") {
    return { state: "needs_review", reasons: review };
  }
  return { state: "listed", reasons: [] };
}

function normalizeListing(
  record: PackageIndependentAdmissionRecord,
  recordPath: string,
  checkedAt: string,
): RegistryEntry {
  const humanReviewed = record.evidence.human_review.status === "approved";
  const runtimeTested = record.evidence.runtime_status === "passed";
  const sourceVersion = record.source.source_type === "repository" ? record.source.version : null;

  return {
    id: record.id,
    name: record.title,
    version: sourceVersion,
    description: record.summary,
    author: record.listing_maintainer,
    license: record.license_expression,
    platform: record.platform,
    minimum_platform_version: null,
    categories: [...record.categories],
    tags: [...record.tags],
    inputs: [],
    outputs: [],
    permissions: null,
    human_review: null,
    safety: null,
    testing: { status: record.evidence.runtime_status },
    package_path: null,
    source_file: null,
    readme_file: null,
    listing_source: "package_independent",
    listing: {
      state: "listed",
      original_creator: record.original_creator,
      creator_evidence: record.creator_evidence,
      listing_maintainer: record.listing_maintainer,
      source: record.source,
      acquisition_url: record.source.acquisition_url,
      license_evidence: record.license_evidence,
      transformation_evidence: record.evidence.transformation_evidence,
      important_limitations: [...record.important_limitations],
      use_steps: [...record.use_steps],
      provenance_reference: record.evidence.evidence_references[0]!,
    },
    claims: {
      discovered: true,
      listed: true,
      static_reviewed: true,
      runtime_tested: runtimeTested,
      compatibility_verified: record.evidence.compatibility_status === "verified",
      human_reviewed: humanReviewed,
      featured: false,
      removed: false,
    },
    validation: {
      status: "admitted",
      errors: [],
      warnings: [],
      checked_at: checkedAt,
    },
  };
}

export async function admitListingCandidate(
  candidate: DiscoveredListingCandidate,
  repositoryRoot: string,
  checkedAt: string,
): Promise<ListingAdmissionResult> {
  const recordPath = toPosixRelative(repositoryRoot, candidate.recordPath);
  let recordText: string;
  try {
    recordText = await readFile(candidate.recordPath, "utf8");
  } catch {
    return {
      recordPath,
      id: null,
      entry: null,
      escalation: {
        record_path: recordPath,
        id: null,
        admission_state: "quarantined",
        reasons: [issue("admission.record-unreadable", "Admission record could not be read.", recordPath)],
      },
    };
  }

  if (containsPotentialSecret(recordText)) {
    return {
      recordPath,
      id: null,
      entry: null,
      escalation: {
        record_path: recordPath,
        id: null,
        admission_state: "quarantined",
        reasons: [issue("admission.record-secret", "Admission metadata contains a potential secret value.", recordPath)],
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(recordText) as unknown;
  } catch {
    return {
      recordPath,
      id: null,
      entry: null,
      escalation: {
        record_path: recordPath,
        id: null,
        admission_state: "quarantined",
        reasons: [issue("admission.invalid-json", "Admission record is not valid JSON.", recordPath)],
      },
    };
  }

  const readableId = isRecord(parsed) && typeof parsed.id === "string" && idPattern.test(parsed.id)
    ? parsed.id
    : null;
  const record = parseAdmissionRecord(parsed);
  if (!record) {
    return {
      recordPath,
      id: readableId,
      entry: null,
      escalation: {
        record_path: recordPath,
        id: readableId,
        admission_state: "needs_review",
        reasons: [issue("admission.invalid-record", "Admission record does not match the strict package-independent Listing contract.", recordPath)],
      },
    };
  }

  const structuralReasons: PublicIssue[] = [];
  if (record.id !== candidate.name) {
    structuralReasons.push(issue("admission.id-file-mismatch", "Listing id must exactly match its JSON filename.", recordPath));
  }
  structuralReasons.push(...await admissionReferenceIssues(record, repositoryRoot, recordPath));

  const decision = decideAdmissionRecord(record, recordPath);
  if (decision.state === "quarantined") {
    return {
      recordPath,
      id: record.id,
      entry: null,
      escalation: { record_path: recordPath, id: record.id, admission_state: "quarantined", reasons: decision.reasons },
    };
  }

  if (structuralReasons.length > 0) {
    return {
      recordPath,
      id: record.id,
      entry: null,
      escalation: {
        record_path: recordPath,
        id: record.id,
        admission_state: "needs_review",
        reasons: structuralReasons,
      },
    };
  }

  if (decision.state === "needs_review") {
    return {
      recordPath,
      id: record.id,
      entry: null,
      escalation: { record_path: recordPath, id: record.id, admission_state: "needs_review", reasons: decision.reasons },
    };
  }

  return {
    recordPath,
    id: record.id,
    entry: normalizeListing(record, recordPath, checkedAt),
    escalation: null,
  };
}
