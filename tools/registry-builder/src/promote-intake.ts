import { lstat, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  admissionReferenceIssues,
  containsPotentialSecret,
  decideAdmissionRecord,
  type AdmissionDecision,
} from "./admit-listing.js";
import type {
  AdmissionRiskSignals,
  PackageIndependentAdmissionRecord,
} from "./types.js";

type JsonRecord = Record<string, unknown>;
type SignalStatus = "detected" | "not_detected" | "unknown";
type LicenseStatus = "no_clear_blocker" | "unclear" | "conflicting" | "blocked";

interface ListingRequest {
  id: string;
  title: string;
  summary: string;
  categories: string[];
  tags: string[];
  listing_maintainer: string;
  important_limitations: string[];
  use_steps: string[];
}

interface PromotionAssessment {
  license_status: LicenseStatus;
  license_evidence: string;
  malicious_content_status: "none_detected" | "suspected" | "not_assessed";
  transformation: {
    status: "none" | "non_material" | "substantial" | "unknown";
    evidence: string;
    transformed_artifact: {
      sha256: string;
      owner: string;
      license: string;
    } | null;
  };
  user_reports: "present" | "none" | "unknown";
}

interface RepositoryIntakeRequest {
  source_type: "repository";
  review_record_path: string;
}

interface DirectUploadIntakeRequest {
  source_type: "direct_upload";
  review_id: string;
  created_at: string;
  submitter: string | null;
  uploaded_at: string | null;
  original_artifact_sha256: string | null;
  declared_author: string | null;
  declared_license: string | null;
  acquisition_url: string | null;
  platform: string;
  artifact_integrity: "verified" | "failed";
  parsing_status: "parsed" | "failed" | "unsupported";
  structure_status: "plausible" | "uncertain";
  secret_scan_status: "none_detected" | "potential_values_detected" | "confirmed_values_detected" | "not_scanned";
  risk_signals: AdmissionRiskSignals;
  runtime_status: "untested" | "passed" | "failed";
  compatibility_status: "unverified" | "verified";
  human_review: {
    status: "not_required" | "approved";
    reviewer: string | null;
    reviewed_at: string | null;
    rationale: string | null;
  };
}

interface PromotionRequest {
  request_version: "1.0";
  listing: ListingRequest;
  assessment: PromotionAssessment;
  intake: RepositoryIntakeRequest | DirectUploadIntakeRequest;
  evidence_references: string[];
}

export interface PromotionPreview {
  record: PackageIndependentAdmissionRecord;
  json: string;
  decision: AdmissionDecision;
  missingEvidence: string[];
  importantSignals: string[];
  inputPath: string;
  outputPath: string;
}

export interface PromoteIntakeOptions {
  repositoryRoot: string;
  inputPath: string;
  outputPath: string;
  write?: boolean;
}

export interface PromoteIntakeResult extends PromotionPreview {
  wrote: boolean;
  reusedExisting: boolean;
}

export class PromotionError extends Error {}
export class PromotionWriteError extends PromotionError {}

const idPattern = /^[a-z0-9][a-z0-9-]{0,127}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;
const signalStatuses = ["detected", "not_detected", "unknown"] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: JsonRecord, expected: string[]): boolean {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || isDate(value);
}

function isStringArray(value: unknown, allowEmpty = true): value is string[] {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every(isNonEmptyString);
}

function isEnum<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.includes(value as T);
}

function isHttpsUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      && parsed.username === ""
      && parsed.password === ""
      && parsed.port === "";
  } catch {
    return false;
  }
}

function isRelativePath(value: unknown): value is string {
  if (!isNonEmptyString(value) || path.isAbsolute(value) || value.includes("\\")) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isEvidenceReference(value: unknown): value is string {
  return isRelativePath(value) || isHttpsUrl(value);
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function repositoryRelative(repositoryRoot: string, candidate: string): string | null {
  const absoluteRoot = path.resolve(repositoryRoot);
  const absoluteCandidate = path.resolve(candidate);
  if (!inside(absoluteRoot, absoluteCandidate) || absoluteCandidate === absoluteRoot) return null;
  return path.relative(absoluteRoot, absoluteCandidate).split(path.sep).join("/");
}

async function assertNoRepositorySymlinks(
  repositoryRoot: string,
  candidate: string,
  label: string,
): Promise<void> {
  const root = path.resolve(repositoryRoot);
  const target = path.resolve(candidate);
  if (!inside(root, target)) return;
  const relative = path.relative(root, target);
  let current = root;
  try {
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      if ((await lstat(current)).isSymbolicLink()) {
        throw new PromotionError(`${label} contains a symbolic-link path component.`);
      }
    }
  } catch (error) {
    if (error instanceof PromotionError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new PromotionError(`${label} path could not be inspected safely.`);
    }
  }
}

function validateListing(value: unknown): value is ListingRequest {
  if (!isRecord(value) || !hasExactKeys(value, [
    "id",
    "title",
    "summary",
    "categories",
    "tags",
    "listing_maintainer",
    "important_limitations",
    "use_steps",
  ])) return false;
  return typeof value.id === "string"
    && idPattern.test(value.id)
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.summary)
    && isStringArray(value.categories)
    && isStringArray(value.tags)
    && isNonEmptyString(value.listing_maintainer)
    && isStringArray(value.important_limitations, false)
    && isStringArray(value.use_steps, false);
}

function validateTransformedArtifact(value: unknown): boolean {
  return value === null || (
    isRecord(value)
    && hasExactKeys(value, ["sha256", "owner", "license"])
    && typeof value.sha256 === "string"
    && sha256Pattern.test(value.sha256)
    && isNonEmptyString(value.owner)
    && isNonEmptyString(value.license)
  );
}

function validateAssessment(value: unknown): value is PromotionAssessment {
  if (!isRecord(value) || !hasExactKeys(value, [
    "license_status",
    "license_evidence",
    "malicious_content_status",
    "transformation",
    "user_reports",
  ])) return false;
  if (!isRecord(value.transformation) || !hasExactKeys(value.transformation, [
    "status",
    "evidence",
    "transformed_artifact",
  ])) return false;
  const transformationStatus = value.transformation.status;
  return isEnum(value.license_status, ["no_clear_blocker", "unclear", "conflicting", "blocked"] as const)
    && isNonEmptyString(value.license_evidence)
    && isEnum(value.malicious_content_status, ["none_detected", "suspected", "not_assessed"] as const)
    && isEnum(transformationStatus, ["none", "non_material", "substantial", "unknown"] as const)
    && isNonEmptyString(value.transformation.evidence)
    && validateTransformedArtifact(value.transformation.transformed_artifact)
    && (transformationStatus !== "none" || value.transformation.transformed_artifact === null)
    && isEnum(value.user_reports, ["present", "none", "unknown"] as const);
}

function validateRiskSignals(value: unknown): value is AdmissionRiskSignals {
  if (!isRecord(value) || !hasExactKeys(value, [
    "credentials",
    "code_execution",
    "filesystem_writes",
    "destructive_actions",
    "external_publishing",
    "high_risk_network",
    "user_reports",
  ])) return false;
  return isEnum(value.credentials, signalStatuses)
    && isEnum(value.code_execution, signalStatuses)
    && isEnum(value.filesystem_writes, signalStatuses)
    && isEnum(value.destructive_actions, signalStatuses)
    && isEnum(value.external_publishing, signalStatuses)
    && isEnum(value.high_risk_network, signalStatuses)
    && isEnum(value.user_reports, ["present", "none", "unknown"] as const);
}

function validateHumanReview(value: unknown): value is DirectUploadIntakeRequest["human_review"] {
  if (!isRecord(value) || !hasExactKeys(value, ["status", "reviewer", "reviewed_at", "rationale"])) {
    return false;
  }
  const status = value.status;
  if (!isEnum(status, ["not_required", "approved"] as const)) return false;
  const empty = value.reviewer === null && value.reviewed_at === null && value.rationale === null;
  const complete = isNonEmptyString(value.reviewer) && isDate(value.reviewed_at) && isNonEmptyString(value.rationale);
  return status === "approved" ? complete : empty;
}

function validateIntake(value: unknown): value is PromotionRequest["intake"] {
  if (!isRecord(value)) return false;
  if (value.source_type === "repository") {
    return hasExactKeys(value, ["source_type", "review_record_path"])
      && isRelativePath(value.review_record_path);
  }
  if (value.source_type !== "direct_upload" || !hasExactKeys(value, [
    "source_type",
    "review_id",
    "created_at",
    "submitter",
    "uploaded_at",
    "original_artifact_sha256",
    "declared_author",
    "declared_license",
    "acquisition_url",
    "platform",
    "artifact_integrity",
    "parsing_status",
    "structure_status",
    "secret_scan_status",
    "risk_signals",
    "runtime_status",
    "compatibility_status",
    "human_review",
  ])) return false;
  return isNonEmptyString(value.review_id)
    && idPattern.test(value.review_id)
    && isDate(value.created_at)
    && isNullableString(value.submitter)
    && isNullableDate(value.uploaded_at)
    && (value.original_artifact_sha256 === null
      || (typeof value.original_artifact_sha256 === "string" && sha256Pattern.test(value.original_artifact_sha256)))
    && isNullableString(value.declared_author)
    && isNullableString(value.declared_license)
    && (value.acquisition_url === null || isHttpsUrl(value.acquisition_url))
    && isNonEmptyString(value.platform)
    && isEnum(value.artifact_integrity, ["verified", "failed"] as const)
    && isEnum(value.parsing_status, ["parsed", "failed", "unsupported"] as const)
    && isEnum(value.structure_status, ["plausible", "uncertain"] as const)
    && isEnum(value.secret_scan_status, [
      "none_detected",
      "potential_values_detected",
      "confirmed_values_detected",
      "not_scanned",
    ] as const)
    && validateRiskSignals(value.risk_signals)
    && isEnum(value.runtime_status, ["untested", "passed", "failed"] as const)
    && isEnum(value.compatibility_status, ["unverified", "verified"] as const)
    && validateHumanReview(value.human_review);
}

function parseRequest(value: unknown): PromotionRequest {
  if (!isRecord(value)
    || !hasExactKeys(value, ["request_version", "listing", "assessment", "intake", "evidence_references"])
    || value.request_version !== "1.0"
    || !validateListing(value.listing)
    || !validateAssessment(value.assessment)
    || !validateIntake(value.intake)
    || !Array.isArray(value.evidence_references)
    || value.evidence_references.length === 0
    || !value.evidence_references.every(isEvidenceReference)
    || new Set(value.evidence_references).size !== value.evidence_references.length) {
    throw new PromotionError("Promotion input does not match the strict controlled request contract.");
  }
  return value as unknown as PromotionRequest;
}

function requireRecord(parent: JsonRecord, key: string): JsonRecord {
  const value = parent[key];
  if (!isRecord(value)) throw new PromotionError(`Intake evidence is missing object field ${key}.`);
  return value;
}

function requireString(parent: JsonRecord, key: string): string {
  const value = parent[key];
  if (!isNonEmptyString(value)) throw new PromotionError(`Intake evidence is missing string field ${key}.`);
  return value;
}

function requireDate(parent: JsonRecord, key: string): string {
  const value = parent[key];
  if (!isDate(value)) throw new PromotionError(`Intake evidence has an invalid timestamp field ${key}.`);
  return value;
}

function signalStatus(value: unknown, field: string): SignalStatus {
  if (!isRecord(value) || !isEnum(value.status, signalStatuses)) {
    throw new PromotionError(`Intake static audit is missing risk status ${field}.`);
  }
  return value.status;
}

function combineSignals(...statuses: SignalStatus[]): SignalStatus {
  if (statuses.includes("detected")) return "detected";
  if (statuses.includes("unknown")) return "unknown";
  return "not_detected";
}

function classifiedWriteSignal(signals: unknown[], pattern: RegExp, parsed: boolean): SignalStatus {
  const found = signals.some((signal) => isRecord(signal)
    && typeof signal.category === "string"
    && pattern.test(signal.category));
  return found ? "detected" : parsed ? "not_detected" : "unknown";
}

function mapRepositoryRisk(staticAudit: JsonRecord): AdmissionRiskSignals {
  const risk = requireRecord(staticAudit, "risk_summary");
  const signals = requireRecord(staticAudit, "signals");
  const externalWriteSignals = Array.isArray(signals.external_writes) ? signals.external_writes : [];
  const parsed = staticAudit.parsing_status === "parsed";
  const credentials = signalStatus(risk.credential_requirements, "credential_requirements");
  const codeExecution = combineSignals(
    signalStatus(risk.code_execution, "code_execution"),
    signalStatus(risk.shell_execution, "shell_execution"),
  );
  const externalWrites = signalStatus(risk.external_writes, "external_writes");
  const network = signalStatus(risk.network_access, "network_access");
  const filesystemWrites = classifiedWriteSignal(externalWriteSignals, /filesystem/i, parsed);
  const externalPublishing = classifiedWriteSignal(externalWriteSignals, /publishing/i, parsed);
  const destructiveActions = externalWrites === "detected"
    ? classifiedWriteSignal(externalWriteSignals, /destructive|delete|remove|drop|truncate/i, false)
    : externalWrites;
  // Network access plus ordinary credential requirements is not, by itself,
  // evidence of high-risk network behavior. Keep the derived status unknown
  // unless Intake has a future explicit high-risk finding to map.
  const highRiskNetwork = network === "not_detected" ? "not_detected" : "unknown";
  return {
    credentials,
    code_execution: codeExecution,
    filesystem_writes: filesystemWrites,
    destructive_actions: destructiveActions,
    external_publishing: externalPublishing,
    high_risk_network: highRiskNetwork,
    user_reports: "unknown",
  };
}

function normalizeGitHubUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    if (parsed.protocol !== "https:"
      || parsed.hostname.toLowerCase() !== "github.com"
      || parsed.username !== ""
      || parsed.password !== ""
      || parsed.port !== ""
      || parsed.search !== ""
      || parsed.hash !== ""
      || segments.length !== 2) return null;
    return `https://github.com/${segments[0]}/${segments[1]}`;
  } catch {
    return null;
  }
}

function licenseRank(status: LicenseStatus): number {
  return ["no_clear_blocker", "unclear", "conflicting", "blocked"].indexOf(status);
}

function strongestLicense(left: LicenseStatus, right: LicenseStatus): LicenseStatus {
  return licenseRank(left) >= licenseRank(right) ? left : right;
}

function repositoryLicense(
  resolvedArtifact: JsonRecord,
  submission: JsonRecord,
  assessment: PromotionAssessment,
): { status: LicenseStatus; expression: string; evidence: string } {
  const license = requireRecord(resolvedArtifact, "license_evidence");
  const repository = requireRecord(license, "repository_level");
  const file = requireRecord(license, "file_level");
  const repositorySpdx = isNonEmptyString(repository.spdx_id) && repository.spdx_id !== "NOASSERTION"
    ? repository.spdx_id
    : null;
  const fileIdentifiers = Array.isArray(file.spdx_identifiers)
    ? file.spdx_identifiers.filter(isNonEmptyString)
    : [];
  const claim = isNonEmptyString(submission.license_claim) ? submission.license_claim : null;
  const independent = repositorySpdx ?? (fileIdentifiers.length === 1 ? fileIdentifiers[0]! : null);
  const conflicts = Boolean(
    (repositorySpdx && fileIdentifiers.length > 0 && !fileIdentifiers.includes(repositorySpdx))
    || (independent && claim && independent.toLowerCase() !== claim.toLowerCase())
    || fileIdentifiers.length > 1
  );
  let recorded: LicenseStatus = "unclear";
  if (conflicts) recorded = "conflicting";
  else if (independent) recorded = "no_clear_blocker";
  const status = strongestLicense(recorded, assessment.license_status);
  const expression = status === "conflicting" || status === "blocked"
    ? "NOASSERTION"
    : independent ?? claim ?? "NOASSERTION";
  return {
    status,
    expression,
    evidence: `${assessment.license_evidence} Recorded repository status: ${String(repository.status)}; file status: ${String(file.status)}.`,
  };
}

function humanReview(
  moderation: JsonRecord,
  evidenceReference: string,
): PackageIndependentAdmissionRecord["evidence"]["human_review"] {
  if (moderation.current_status === "rejected") {
    throw new PromotionError("Rejected Intake evidence cannot be promoted.");
  }
  if (moderation.current_status !== "approved") {
    return {
      status: "not_required",
      evidence_reference: null,
      reviewer: null,
      reviewed_at: null,
      rationale: null,
    };
  }
  const decision = requireRecord(moderation, "human_decision");
  return {
    status: "approved",
    evidence_reference: evidenceReference,
    reviewer: requireString(decision, "reviewer"),
    reviewed_at: requireDate(decision, "reviewed_at"),
    rationale: requireString(decision, "rationale"),
  };
}

function directHumanReview(
  value: DirectUploadIntakeRequest["human_review"],
  evidenceReference: string,
): PackageIndependentAdmissionRecord["evidence"]["human_review"] {
  return value.status === "approved"
    ? {
      status: "approved",
      evidence_reference: evidenceReference,
      reviewer: value.reviewer,
      reviewed_at: value.reviewed_at,
      rationale: value.rationale,
    }
    : {
      status: "not_required",
      evidence_reference: null,
      reviewer: null,
      reviewed_at: null,
      rationale: null,
    };
}

function creatorEvidenceFromSubmission(submission: JsonRecord): string {
  const submitter = requireRecord(submission, "submitter");
  const upstream = isNonEmptyString(submission.upstream_author_or_organization)
    ? submission.upstream_author_or_organization
    : null;
  const authorshipClaim = submitter.claims_authorship === true;
  if (upstream) {
    return `Intake records ${upstream} as a submitted upstream creator claim; the claim is not independently established.`;
  }
  if (authorshipClaim) {
    return `The submitter claims authorship in Intake; identity and authorship are not independently established.`;
  }
  return "Original creator was not established from the available Intake evidence.";
}

function repositoryRecord(
  request: PromotionRequest,
  review: JsonRecord,
  reviewEvidenceReference: string,
): PackageIndependentAdmissionRecord {
  if (review.record_version !== "1.0") throw new PromotionError("Unsupported Intake review record version.");
  const reviewId = requireString(review, "review_id");
  const createdAt = requireDate(review, "created_at");
  const submission = requireRecord(review, "original_submission");
  const resolved = requireRecord(review, "resolved_artifact");
  const repository = requireRecord(resolved, "repository");
  const artifact = requireRecord(resolved, "artifact");
  const fingerprint = isRecord(resolved.fingerprint) ? resolved.fingerprint : null;
  const requestedRef = requireRecord(resolved, "requested_ref");
  const staticAudit = requireRecord(review, "static_audit");
  const moderation = requireRecord(review, "moderation");
  const repositoryUrl = requireString(repository, "normalized_url");
  const submittedUrl = requireString(repository, "submitted_url");
  const normalizedSubmitted = normalizeGitHubUrl(submittedUrl);
  const normalizedRepository = normalizeGitHubUrl(repositoryUrl);
  const requestedPath = requireString(artifact, "requested_path");
  const verifiedPath = isRelativePath(artifact.verified_case_sensitive_path)
    ? artifact.verified_case_sensitive_path
    : null;
  const artifactPath = verifiedPath ?? requestedPath;
  const immutableRef = typeof resolved.resolved_commit === "string"
    && commitPattern.test(resolved.resolved_commit.toLowerCase())
    ? resolved.resolved_commit.toLowerCase()
    : null;
  const rawUrl = isHttpsUrl(artifact.raw_url) ? artifact.raw_url : null;
  const sha256 = fingerprint
    && typeof fingerprint.sha256 === "string"
    && sha256Pattern.test(fingerprint.sha256.toLowerCase())
    ? fingerprint.sha256.toLowerCase()
    : null;
  if (!normalizedRepository || repositoryUrl !== normalizedRepository || !isRelativePath(artifactPath)) {
    throw new PromotionError("Repository Intake evidence lacks a valid repository identity or artifact path.");
  }
  const encodedPath = artifactPath.split("/").map(encodeURIComponent).join("/");
  const expectedRaw = immutableRef
    ? `${repositoryUrl.replace("github.com", "raw.githubusercontent.com")}/${immutableRef}/${encodedPath}`
    : null;
  const coordinatesComplete = immutableRef !== null
    && verifiedPath !== null
    && rawUrl !== null
    && rawUrl === expectedRaw;

  const parsed = staticAudit.parsing_status === "parsed";
  const secretScan = requireRecord(staticAudit, "secret_scan");
  const parsingStatus = parsed
    ? "parsed"
    : staticAudit.recommended_moderation_status === "quarantined"
        && secretScan.status !== "potential_values_detected"
      ? "failed"
      : "unsupported";
  const sourceResolved = resolved.resolution_status === "resolved" && coordinatesComplete;
  const integrityVerified = sourceResolved
    && sha256 !== null
    && fingerprint?.git_blob_sha_matches === true
    && fingerprint.stored_artifact_matches_fetched === true
    && verifiedPath === requestedPath;
  const provenanceRecorded = integrityVerified
    && normalizedSubmitted === normalizedRepository
    && isDate(resolved.retrieved_at);
  const license = repositoryLicense(resolved, submission, request.assessment);
  const riskSignals = mapRepositoryRisk(staticAudit);
  riskSignals.user_reports = request.assessment.user_reports;
  const version = requestedRef.kind === "tag" && isNonEmptyString(requestedRef.value)
    ? requestedRef.value
    : null;

  return {
    record_version: "1.0",
    ...request.listing,
    platform: requireString(staticAudit, "platform"),
    original_creator: null,
    creator_evidence: creatorEvidenceFromSubmission(submission),
    license_expression: license.expression,
    license_evidence: license.evidence,
    source: {
      source_type: "repository",
      repository_url: repositoryUrl,
      artifact_url: coordinatesComplete ? `${repositoryUrl}/blob/${immutableRef}/${encodedPath}` : null,
      acquisition_url: coordinatesComplete ? rawUrl : null,
      artifact_path: artifactPath,
      immutable_ref: coordinatesComplete ? immutableRef : null,
      original_artifact_sha256: sha256,
      version,
    },
    evidence: {
      intake_review_id: reviewId,
      intake_created_at: createdAt,
      artifact_retrieved_at: isDate(resolved.retrieved_at) ? resolved.retrieved_at : null,
      provenance_status: provenanceRecorded ? "recorded" : "uncertain",
      source_resolution: sourceResolved ? "resolved" : "failed",
      artifact_integrity: integrityVerified ? "verified" : "failed",
      parsing_status: parsingStatus,
      structure_status: parsed ? "plausible" : "uncertain",
      license_status: license.status,
      secret_scan_status: isEnum(secretScan.status, ["none_detected", "potential_values_detected", "not_scanned"] as const)
        ? secretScan.status
        : "not_scanned",
      malicious_content_status: request.assessment.malicious_content_status,
      transformation_status: request.assessment.transformation.status,
      transformation_evidence: request.assessment.transformation.evidence,
      transformed_artifact: request.assessment.transformation.transformed_artifact,
      risk_signals: riskSignals,
      runtime_status: staticAudit.runtime_status === "untested" ? "untested" : "failed",
      compatibility_status: staticAudit.compatibility_status === "unverified" ? "unverified" : "verified",
      evidence_references: [...request.evidence_references],
      human_review: humanReview(moderation, reviewEvidenceReference),
    },
  };
}

function directUploadRecord(
  request: PromotionRequest,
  intake: DirectUploadIntakeRequest,
): PackageIndependentAdmissionRecord {
  const provenanceComplete = intake.submitter !== null
    && intake.uploaded_at !== null
    && intake.original_artifact_sha256 !== null
    && intake.declared_author !== null
    && intake.declared_license !== null;
  const licenseStatus = intake.declared_license === null
    ? strongestLicense("unclear", request.assessment.license_status)
    : request.assessment.license_status;
  const riskSignals = { ...intake.risk_signals, user_reports: request.assessment.user_reports };
  return {
    record_version: "1.0",
    ...request.listing,
    platform: intake.platform,
    original_creator: null,
    creator_evidence: intake.declared_author === null
      ? "No declared author is present in the direct-upload Intake evidence."
      : `Direct-upload Intake records ${intake.declared_author} as a declared author; authorship is not independently established.`,
    license_expression: intake.declared_license ?? "NOASSERTION",
    license_evidence: request.assessment.license_evidence,
    source: {
      source_type: "direct_upload",
      submitter: intake.submitter,
      uploaded_at: intake.uploaded_at,
      original_artifact_sha256: intake.original_artifact_sha256,
      declared_author: intake.declared_author,
      declared_license: intake.declared_license,
      acquisition_url: intake.acquisition_url,
    },
    evidence: {
      intake_review_id: intake.review_id,
      intake_created_at: intake.created_at,
      artifact_retrieved_at: null,
      provenance_status: provenanceComplete ? "recorded" : "uncertain",
      source_resolution: "not_applicable",
      artifact_integrity: intake.original_artifact_sha256 === null ? "failed" : intake.artifact_integrity,
      parsing_status: intake.parsing_status,
      structure_status: intake.structure_status,
      license_status: licenseStatus,
      secret_scan_status: intake.secret_scan_status,
      malicious_content_status: request.assessment.malicious_content_status,
      transformation_status: request.assessment.transformation.status,
      transformation_evidence: request.assessment.transformation.evidence,
      transformed_artifact: request.assessment.transformation.transformed_artifact,
      risk_signals: riskSignals,
      runtime_status: intake.runtime_status,
      compatibility_status: intake.compatibility_status,
      evidence_references: [...request.evidence_references],
      human_review: directHumanReview(intake.human_review, request.evidence_references[0]!),
    },
  };
}

function missingEvidence(record: PackageIndependentAdmissionRecord): string[] {
  const missing: string[] = [];
  if (record.evidence.provenance_status !== "recorded") missing.push("complete provenance");
  if (record.evidence.artifact_integrity !== "verified") missing.push("verified artifact integrity");
  if (record.evidence.parsing_status !== "parsed") missing.push("supported static parse");
  if (record.evidence.structure_status !== "plausible") missing.push("plausible workflow structure");
  if (record.evidence.license_status !== "no_clear_blocker") missing.push("clear non-blocking license evidence");
  if (record.evidence.secret_scan_status !== "none_detected") missing.push("completed secret screening without findings");
  if (record.evidence.malicious_content_status === "suspected") missing.push("malicious-content blocker resolution");
  if (["substantial", "unknown"].includes(record.evidence.transformation_status)) missing.push("non-escalating transformation evidence");
  for (const [name, status] of Object.entries(record.evidence.risk_signals)) {
    const exceptionalCapability = [
      "filesystem_writes",
      "destructive_actions",
      "external_publishing",
      "high_risk_network",
    ].includes(name);
    if ((name === "user_reports" && status === "present") || (exceptionalCapability && status === "detected")) {
      missing.push(`resolved ${name.replaceAll("_", " ")} exception`);
    }
  }
  if (record.source.source_type === "direct_upload") {
    if (record.source.submitter === null) missing.push("direct-upload submitter");
    if (record.source.uploaded_at === null) missing.push("direct-upload timestamp");
    if (record.source.original_artifact_sha256 === null) missing.push("direct-upload original artifact hash");
    if (record.source.declared_author === null) missing.push("direct-upload declared author");
    if (record.source.declared_license === null) missing.push("direct-upload declared license");
  }
  return [...new Set(missing)];
}

function importantSignals(record: PackageIndependentAdmissionRecord): string[] {
  const signals = Object.entries(record.evidence.risk_signals)
    .filter(([name, status]) => name === "user_reports" ? status === "present" : status === "detected")
    .map(([name, status]) => `${name}=${status}`);
  if (record.evidence.secret_scan_status !== "none_detected") {
    signals.push(`secret_scan=${record.evidence.secret_scan_status}`);
  }
  if (record.evidence.malicious_content_status === "suspected") {
    signals.push(`malicious_content=${record.evidence.malicious_content_status}`);
  }
  if (record.evidence.transformation_status !== "none") {
    signals.push(`transformation=${record.evidence.transformation_status}`);
  }
  return signals;
}

async function readJsonFile(filePath: string, label: string): Promise<{ value: unknown; text: string }> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    throw new PromotionError(`${label} could not be read.`);
  }
  if (containsPotentialSecret(text)) throw new PromotionError(`${label} contains a potential secret value.`);
  try {
    return { value: JSON.parse(text) as unknown, text };
  } catch {
    throw new PromotionError(`${label} is not valid JSON.`);
  }
}

function assertOutputTarget(repositoryRoot: string, outputPath: string, id: string): void {
  if (path.basename(outputPath) !== `${id}.json`) {
    throw new PromotionError("Output filename must exactly match the deterministic admission record id.");
  }
  const root = path.resolve(repositoryRoot);
  const target = path.resolve(outputPath);
  const protectedPaths = ["packages", "registry", "website", ".git", path.join("tools", "intake")]
    .map((part) => path.join(root, part));
  if (protectedPaths.some((protectedPath) => inside(protectedPath, target))) {
    throw new PromotionError("Promotion output must remain outside Intake, Packages, Registry, website, and Git metadata.");
  }
}

async function writeDeterministic(outputPath: string, json: string): Promise<{ wrote: boolean; reused: boolean }> {
  const parent = path.dirname(outputPath);
  let parentStats;
  try {
    parentStats = await lstat(parent);
  } catch {
    throw new PromotionWriteError("Output directory does not exist.");
  }
  if (!parentStats.isDirectory() || parentStats.isSymbolicLink()) {
    throw new PromotionWriteError("Output directory must be a real directory, not a symbolic link.");
  }
  try {
    const targetStats = await lstat(outputPath);
    if (!targetStats.isFile() || targetStats.isSymbolicLink()) {
      throw new PromotionWriteError("Output path already exists and is not a regular file.");
    }
    const existing = await readFile(outputPath, "utf8");
    if (existing !== json) throw new PromotionWriteError("Output collision: an existing admission record has different bytes.");
    return { wrote: false, reused: true };
  } catch (error) {
    if (error instanceof PromotionError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new PromotionWriteError("Output path could not be inspected safely.");
  }
  try {
    await writeFile(outputPath, json, { encoding: "utf8", flag: "wx", mode: 0o644 });
    return { wrote: true, reused: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const existing = await readFile(outputPath, "utf8");
      if (existing === json) return { wrote: false, reused: true };
    }
    throw new PromotionWriteError("Admission record could not be written without overwriting existing evidence.");
  }
}

export async function previewIntakePromotion(options: PromoteIntakeOptions): Promise<PromotionPreview> {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const inputPath = path.resolve(options.inputPath);
  const outputPath = path.resolve(options.outputPath);
  await assertNoRepositorySymlinks(repositoryRoot, inputPath, "Promotion input");
  const requestFile = await readJsonFile(inputPath, "Promotion input");
  const request = parseRequest(requestFile.value);
  assertOutputTarget(repositoryRoot, outputPath, request.listing.id);
  await assertNoRepositorySymlinks(repositoryRoot, outputPath, "Promotion output");

  let record: PackageIndependentAdmissionRecord;
  if (request.intake.source_type === "repository") {
    const reviewReference = request.intake.review_record_path;
    const reviewPath = path.resolve(repositoryRoot, ...reviewReference.split("/"));
    if (!inside(repositoryRoot, reviewPath)) throw new PromotionError("Intake review reference escapes the repository.");
    await assertNoRepositorySymlinks(repositoryRoot, reviewPath, "Intake review reference");
    try {
      if (!(await stat(reviewPath)).isFile()) throw new Error("not-file");
    } catch {
      throw new PromotionError("Referenced Intake review record is unavailable.");
    }
    const reviewFile = await readJsonFile(reviewPath, "Intake review record");
    if (!isRecord(reviewFile.value)) throw new PromotionError("Intake review record must be a JSON object.");
    const reviewEvidenceReference = request.evidence_references.includes(reviewReference)
      ? reviewReference
      : request.evidence_references[0]!;
    record = repositoryRecord(request, reviewFile.value, reviewEvidenceReference);
  } else {
    record = directUploadRecord(request, request.intake);
  }

  const json = `${JSON.stringify(record, null, 2)}\n`;
  const recordPath = repositoryRelative(repositoryRoot, outputPath) ?? outputPath;
  const coreDecision = decideAdmissionRecord(record, recordPath);
  const unavailableReferences = await admissionReferenceIssues(record, repositoryRoot, recordPath);
  const decision = coreDecision.state === "quarantined" || unavailableReferences.length === 0
    ? coreDecision
    : { state: "needs_review" as const, reasons: unavailableReferences };
  const missing = missingEvidence(record);
  if (unavailableReferences.length > 0) missing.push("available stable evidence references");
  return {
    record,
    json,
    decision,
    missingEvidence: missing,
    importantSignals: importantSignals(record),
    inputPath,
    outputPath,
  };
}

export async function promoteIntake(options: PromoteIntakeOptions): Promise<PromoteIntakeResult> {
  const preview = await previewIntakePromotion(options);
  if (!options.write) return { ...preview, wrote: false, reusedExisting: false };
  const result = await writeDeterministic(preview.outputPath, preview.json);
  return { ...preview, wrote: result.wrote, reusedExisting: result.reused };
}
