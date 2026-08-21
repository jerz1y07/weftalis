import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;
type OperationalState = "pending" | "processing" | "completed" | "failed";
type AdmissionState = "listed" | "needs_review" | "quarantined";

export interface Submission {
  record_version: "1.0";
  submission_id?: string;
  repository_url: string;
  artifact_path: string;
  commit?: string;
  platform_hint?: "dify" | "n8n" | "unknown";
  workflow_name: string;
  description: string;
  submitter: { name_or_handle: string; claims_authorship: boolean };
  upstream_author_or_organization?: string;
  license_claim?: string;
  notes?: string;
}

export interface SubmissionManifest {
  manifest_version: "1.0";
  submissions: Submission[];
}

export interface DiscoveryCandidate {
  record_version: "1.0";
  candidate_id: string;
  dedupe_identity: string;
  source_type: "repository";
  platform: "dify" | "n8n" | "unknown";
  title: string;
  repository: {
    url: string;
    owner: string;
    name: string;
    visibility: "public";
    archived: boolean;
  };
  repository_owner_evidence: JsonRecord | null;
  immutable_ref: { kind: "commit"; commit: string; default_branch: string };
  artifact: {
    path: string;
    format: string;
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
  discovery_sources: JsonRecord[];
  discovered_at: string;
  provenance: Array<{ kind: string; url: string }>;
  warnings: JsonRecord[];
}

interface BatchCandidate {
  id: string;
  identity: string;
  submission: Submission;
  discovery: DiscoveryCandidate | null;
  evidenceTime: string;
}

interface IntakeProcessed {
  record: JsonRecord;
  reviewDirectory: string | null;
  reusedExisting: boolean;
}

interface IntakeResult {
  processed: IntakeProcessed[];
  failedCount: number;
}

interface PromotionResult {
  record: JsonRecord & { evidence?: JsonRecord; source?: JsonRecord };
  decision: { state: AdmissionState; reasons: unknown[] };
  wrote: boolean;
  reusedExisting: boolean;
}

interface RegistryBuildResult {
  registry: { workflow_count: number; workflows: Array<{ listing_source: string }> };
  rejected: {
    rejected_count: number;
    packages: unknown[];
    listings: Array<{ admission_state: "needs_review" | "quarantined" }>;
  };
  discoveredCount: number;
  discoveredListingCount: number;
}

export interface OrchestratorDependencies {
  loadSubmissionManifest: (manifestPath: string) => Promise<SubmissionManifest>;
  runIntake: (options: JsonRecord) => Promise<IntakeResult>;
  promoteIntake: (options: JsonRecord) => Promise<PromotionResult>;
  buildRegistry: (options: JsonRecord) => Promise<RegistryBuildResult>;
  writeRegistryOutput: (
    repositoryRoot: string,
    registry: RegistryBuildResult["registry"],
    rejected: RegistryBuildResult["rejected"],
  ) => Promise<void>;
  validatePackage: (packagePath: string) => Promise<unknown>;
}

export interface BatchOptions {
  repositoryRoot: string;
  inputPath: string;
  write: boolean;
  resume?: boolean;
  limit?: number;
  concurrency?: number;
  runId?: string;
  registryPreview?: boolean;
  dependencies?: OrchestratorDependencies;
}

interface CandidateResult {
  candidate_id: string;
  identity: string;
  status: "completed" | "failed";
  error: string | null;
  intake: {
    completed: boolean;
    failed: boolean;
    reused_existing: boolean;
    review_id: string | null;
    resolution_status: string | null;
    failure_code: string | null;
    parsing_status: string | null;
    secret_finding_count: number;
    repository_license_status: string;
    file_license_status: string;
    artifact_sha256: string | null;
    immutable_reference_preserved: boolean;
    duplicate_artifact: boolean;
    duplicate_source: boolean;
  };
  promotion: {
    completed: boolean;
    admission_state: AdmissionState | null;
    listing_id: string | null;
    record_path: string | null;
    reused_existing: boolean;
    provenance_status: string | null;
  };
}

export interface BatchSummary {
  summary_version: "1.0";
  run_id: string;
  input_hash: string;
  mode: "dry_run" | "write";
  candidates_supplied: number;
  candidates_selected: number;
  candidates_attempted: number;
  candidates_skipped_completed: number;
  operational_states: Record<OperationalState, number>;
  intake_completed: number;
  intake_failed: number;
  admission_promotion_completed: number;
  staged_admission_states: Record<AdmissionState, number>;
  artifact_retrieval_failures: number;
  parse_failures: number;
  secret_findings: number;
  license_evidence_outcomes: Record<string, number>;
  provenance_completeness: Record<string, number>;
  immutable_reference_preserved: number;
  duplicates: { immutable_identity: number; artifact_hash: number; source: number };
  collisions: number;
  retries: number;
  resumability_exercised: boolean;
  protected_directory_writes: number;
  imported_workflow_executions: 0;
  registry_preview: null | {
    package_backed_candidates: number;
    admission_candidates: number;
    listed_total: number;
    package_independent_listed: number;
    needs_review: number;
    quarantined: number;
    output_directory: string;
  };
  candidates: CandidateResult[];
}

interface RunState {
  state_version: "1.0";
  run_id: string;
  input_hash: string;
  candidate_order: string[];
  candidates: Record<string, { status: OperationalState; attempts: number }>;
}

export class OrchestrationError extends Error {}

const idPattern = /^[a-z0-9][a-z0-9-]{0,127}$/;
const shaPattern = /^[0-9a-f]{40}$/;
const protectedRoots = ["packages", "admissions", "registry", "website"];

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createMemoizedGitHubFetch(fetcher: FetchLike = globalThis.fetch): FetchLike {
  const requests = new Map<string, Promise<Response>>();
  return async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "GET" || url.hostname.toLowerCase() !== "api.github.com") {
      return fetcher(input, init);
    }
    const key = url.toString();
    let pending = requests.get(key);
    if (!pending) {
      pending = fetcher(input, init).then((response) => {
        if (!response.ok) requests.delete(key);
        return response;
      }, (error) => {
        requests.delete(key);
        throw error;
      });
      requests.set(key, pending);
    }
    return (await pending).clone();
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, nested]) => [key, stableValue(nested)]));
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function relativePath(repositoryRoot: string, filePath: string): string {
  const absolute = path.resolve(filePath);
  if (!inside(path.resolve(repositoryRoot), absolute)) {
    throw new OrchestrationError("Batch evidence path escaped the repository root.");
  }
  return path.relative(repositoryRoot, absolute).split(path.sep).join("/");
}

function redact(value: unknown): string {
  let text = value instanceof Error ? value.message : String(value);
  for (const token of [process.env.GITHUB_TOKEN, process.env.GH_TOKEN].filter(Boolean) as string[]) {
    text = text.split(token).join("[REDACTED]");
  }
  return text
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[REDACTED]")
    .replace(/\b(Bearer|token|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 500);
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, stableJson(value), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, filePath);
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    throw new OrchestrationError(`Required JSON evidence could not be read: ${path.basename(filePath)}.`);
  }
}

function candidateIdentity(submission: Submission): string {
  const commit = submission.commit?.toLowerCase() ?? "unknown";
  return `github:${submission.repository_url.toLowerCase()}@${commit}:${submission.artifact_path}`;
}

function candidateId(submission: Submission, discovery: DiscoveryCandidate | null): string {
  const supplied = discovery?.candidate_id ?? submission.submission_id;
  return supplied && idPattern.test(supplied)
    ? supplied
    : `ing-${digest(candidateIdentity(submission)).slice(0, 32)}`;
}

function validDiscoveryCandidate(value: unknown): value is DiscoveryCandidate {
  return isRecord(value)
    && value.record_version === "1.0"
    && typeof value.candidate_id === "string"
    && typeof value.dedupe_identity === "string"
    && value.source_type === "repository"
    && typeof value.discovered_at === "string"
    && !Number.isNaN(Date.parse(value.discovered_at));
}

async function locateInput(inputPath: string): Promise<{
  manifestPath: string;
  candidatesPath: string | null;
  reportPath: string | null;
}> {
  const absolute = path.resolve(inputPath);
  let metadata;
  try {
    metadata = await stat(absolute);
  } catch {
    throw new OrchestrationError("Discovery run or Intake manifest does not exist.");
  }
  const directory = metadata.isDirectory() ? absolute : path.dirname(absolute);
  const manifestPath = metadata.isDirectory() ? path.join(absolute, "intake-manifest.json") : absolute;
  const candidates = ["candidates.jsonl", "candidates.json"];
  let candidatesPath: string | null = null;
  for (const name of candidates) {
    try {
      if ((await stat(path.join(directory, name))).isFile()) {
        candidatesPath = path.join(directory, name);
        break;
      }
    } catch { /* optional */ }
  }
  let reportPath: string | null = null;
  try {
    if ((await stat(path.join(directory, "report.json"))).isFile()) reportPath = path.join(directory, "report.json");
  } catch { /* optional */ }
  return { manifestPath, candidatesPath, reportPath };
}

async function loadDiscoveryCandidates(filePath: string | null): Promise<DiscoveryCandidate[]> {
  if (!filePath) return [];
  const text = await readFile(filePath, "utf8");
  let values: unknown[];
  if (filePath.endsWith(".jsonl")) {
    values = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as unknown);
  } else {
    const parsed = JSON.parse(text) as unknown;
    values = isRecord(parsed) && Array.isArray(parsed.candidates) ? parsed.candidates : [];
  }
  if (!values.every(validDiscoveryCandidate)) {
    throw new OrchestrationError("Discovery candidate evidence does not match the expected v1 contract.");
  }
  return values;
}

async function loadBatch(
  inputPath: string,
  dependencies: OrchestratorDependencies,
): Promise<{ candidates: BatchCandidate[]; inputHash: string; duplicateIdentities: number }> {
  const located = await locateInput(inputPath);
  const manifest = await dependencies.loadSubmissionManifest(located.manifestPath);
  const discoveries = await loadDiscoveryCandidates(located.candidatesPath);
  const discoveryById = new Map(discoveries.map((candidate) => [candidate.candidate_id, candidate]));
  let reportTime: string | null = null;
  if (located.reportPath) {
    const report = await readJson(located.reportPath);
    if (isRecord(report) && typeof report.discovered_at === "string" && !Number.isNaN(Date.parse(report.discovered_at))) {
      reportTime = report.discovered_at;
    }
  }

  const candidates = manifest.submissions.map((submission) => {
    const discovery = submission.submission_id ? discoveryById.get(submission.submission_id) ?? null : null;
    const evidenceTime = discovery?.discovered_at ?? reportTime;
    if (!evidenceTime) {
      throw new OrchestrationError(
        "A recorded Discovery timestamp is required; use a Discovery run or a manifest beside report.json.",
      );
    }
    if (discovery) {
      const coordinatesMatch = discovery.repository.url === submission.repository_url
        && discovery.artifact.path === submission.artifact_path
        && discovery.immutable_ref.commit === submission.commit;
      if (!coordinatesMatch) {
        throw new OrchestrationError(`Discovery and Intake coordinates disagree for ${discovery.candidate_id}.`);
      }
    }
    return {
      id: candidateId(submission, discovery),
      identity: discovery?.dedupe_identity ?? candidateIdentity(submission),
      submission,
      discovery,
      evidenceTime,
    };
  }).sort((left, right) => (
    left.identity.localeCompare(right.identity, "en") || left.id.localeCompare(right.id, "en")
  ));

  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (ids.has(candidate.id)) throw new OrchestrationError(`Deterministic candidate id collision: ${candidate.id}.`);
    ids.add(candidate.id);
  }
  const identities = candidates.map((candidate) => candidate.identity);
  const duplicateIdentities = identities.length - new Set(identities).size;
  const inputHash = digest(stableJson({
    manifest,
    discoveries,
    report_time: reportTime,
  }));
  return { candidates, inputHash, duplicateIdentities };
}

function licenseAssessment(review: JsonRecord): { status: string; evidence: string } {
  const resolved = isRecord(review.resolved_artifact) ? review.resolved_artifact : {};
  const license = isRecord(resolved.license_evidence) ? resolved.license_evidence : {};
  const repository = isRecord(license.repository_level) ? license.repository_level : {};
  const file = isRecord(license.file_level) ? license.file_level : {};
  const submission = isRecord(review.original_submission) ? review.original_submission : {};
  const repositorySpdx = typeof repository.spdx_id === "string" && repository.spdx_id !== "NOASSERTION"
    ? repository.spdx_id
    : null;
  const fileIds = Array.isArray(file.spdx_identifiers)
    ? file.spdx_identifiers.filter((item): item is string => typeof item === "string")
    : [];
  const claim = typeof submission.license_claim === "string" ? submission.license_claim : null;
  const independent = repositorySpdx ?? (fileIds.length === 1 ? fileIds[0]! : null);
  const conflicting = fileIds.length > 1
    || Boolean(repositorySpdx && fileIds.length > 0 && !fileIds.includes(repositorySpdx))
    || Boolean(independent && claim && independent.toLowerCase() !== claim.toLowerCase());
  const status = conflicting ? "conflicting" : independent ? "no_clear_blocker" : "unclear";
  return {
    status,
    evidence: [
      `Intake recorded repository-level license status ${String(repository.status ?? "unavailable")}`,
      `and file-level status ${String(file.status ?? "not_scanned")}.`,
      "Repository-level evidence may not apply to the artifact and is not legal authorization.",
    ].join(" "),
  };
}

export function derivePromotionRequest(options: {
  candidate: BatchCandidate;
  review: JsonRecord;
  reviewReference: string;
  candidateReference: string;
}): JsonRecord {
  const license = licenseAssessment(options.review);
  const provenance = options.candidate.discovery?.provenance
    .map((entry) => entry.url)
    .filter((url) => url.startsWith("https://")) ?? [];
  const limitations = [
    options.candidate.discovery?.license_evidence.limitation,
    "Not independently runtime-tested by Weft Place.",
    "Static Intake evidence does not establish safety, compatibility, production readiness, or quality.",
  ].filter((value): value is string => Boolean(value));
  return {
    request_version: "1.0",
    listing: {
      id: options.candidate.id,
      title: options.candidate.discovery?.title ?? options.candidate.submission.workflow_name,
      summary: options.candidate.submission.description,
      categories: [],
      tags: [],
      listing_maintainer: "Weft Place batch ingestion",
      important_limitations: [...new Set(limitations)],
      use_steps: ["Inspect the exact immutable upstream artifact and platform requirements before import."],
    },
    assessment: {
      license_status: license.status,
      license_evidence: license.evidence,
      malicious_content_status: "not_assessed",
      transformation: {
        status: "none",
        evidence: "Batch Intake preserved the original retrieved artifact bytes without transformation.",
        transformed_artifact: null,
      },
      user_reports: "unknown",
    },
    intake: {
      source_type: "repository",
      review_record_path: options.reviewReference,
    },
    evidence_references: [...new Set([
      options.reviewReference,
      options.candidateReference,
      ...provenance,
    ])],
  };
}

function stringField(record: JsonRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] as string : null;
}

function reviewFacts(
  candidate: BatchCandidate,
  processed: IntakeProcessed,
  intakeFailed: boolean,
): CandidateResult["intake"] {
  const review = processed.record;
  const resolved = isRecord(review.resolved_artifact) ? review.resolved_artifact : {};
  const audit = isRecord(review.static_audit) ? review.static_audit : {};
  const fingerprint = isRecord(resolved.fingerprint) ? resolved.fingerprint : {};
  const failure = isRecord(resolved.failure) ? resolved.failure : {};
  const license = isRecord(resolved.license_evidence) ? resolved.license_evidence : {};
  const repositoryLicense = isRecord(license.repository_level) ? license.repository_level : {};
  const fileLicense = isRecord(license.file_level) ? license.file_level : {};
  const secretAudit = isRecord(audit.secret_scan) ? audit.secret_scan : {};
  const duplicates = isRecord(review.duplicate_status) ? review.duplicate_status : {};
  return {
    completed: true,
    failed: intakeFailed || resolved.resolution_status === "failed",
    reused_existing: processed.reusedExisting,
    review_id: stringField(review, "review_id"),
    resolution_status: stringField(resolved, "resolution_status"),
    failure_code: stringField(failure, "code"),
    parsing_status: stringField(audit, "parsing_status"),
    secret_finding_count: typeof secretAudit.finding_count === "number" ? secretAudit.finding_count : 0,
    repository_license_status: stringField(repositoryLicense, "status") ?? "unavailable",
    file_license_status: stringField(fileLicense, "status") ?? "not_scanned",
    artifact_sha256: stringField(fingerprint, "sha256"),
    immutable_reference_preserved: stringField(resolved, "resolved_commit") === candidate.submission.commit,
    duplicate_artifact: duplicates.duplicate_artifact === true,
    duplicate_source: duplicates.duplicate_source === true,
  };
}

function emptyIntake(): CandidateResult["intake"] {
  return {
    completed: false,
    failed: true,
    reused_existing: false,
    review_id: null,
    resolution_status: null,
    failure_code: null,
    parsing_status: null,
    secret_finding_count: 0,
    repository_license_status: "unavailable",
    file_license_status: "not_scanned",
    artifact_sha256: null,
    immutable_reference_preserved: false,
    duplicate_artifact: false,
    duplicate_source: false,
  };
}

async function runCandidate(options: {
  repositoryRoot: string;
  runRoot: string | null;
  candidate: BatchCandidate;
  write: boolean;
  attempt: number;
  dependencies: OrchestratorDependencies;
}): Promise<CandidateResult> {
  const temporaryRoot = options.write
    ? path.join(options.runRoot!, "candidates", options.candidate.id)
    : path.join(options.repositoryRoot, "ingestion-workspace", ".dry-run-never-written", options.candidate.id);
  const candidateRoot = temporaryRoot;
  const manifestPath = path.join(candidateRoot, "intake-manifest.json");
  const candidatePath = path.join(candidateRoot, "candidate.json");
  const intakeRoot = path.join(candidateRoot, "intake");
  const promotionPath = options.attempt === 1
    ? path.join(candidateRoot, "promotion-request.json")
    : path.join(candidateRoot, "promotion-attempts", `attempt-${options.attempt}.json`);
  const admissionPath = options.attempt === 1
    ? path.join(candidateRoot, "admission", `${options.candidate.id}.json`)
    : path.join(candidateRoot, "admission-attempts", `attempt-${options.attempt}`, `${options.candidate.id}.json`);
  let facts = emptyIntake();

  try {
    if (!options.write) {
      throw new OrchestrationError("Dry-run candidate storage dependency was not initialized.");
    }
    await mkdir(candidateRoot, { recursive: true, mode: 0o700 });
    await writeJsonAtomic(manifestPath, {
      manifest_version: "1.0",
      submissions: [options.candidate.submission],
    });
    await writeJsonAtomic(candidatePath, {
      candidate_id: options.candidate.id,
      immutable_identity: options.candidate.identity,
      discovery_candidate: options.candidate.discovery,
      intake_submission: options.candidate.submission,
    });
    const intake = await options.dependencies.runIntake({
      manifestPath,
      repositoryRoot: options.repositoryRoot,
      outputRoot: intakeRoot,
      dryRun: false,
      now: () => options.candidate.evidenceTime,
    });
    const processed = intake.processed[0];
    if (!processed?.reviewDirectory) throw new OrchestrationError("Intake did not produce one persisted review record.");
    facts = reviewFacts(options.candidate, processed, intake.failedCount > 0);
    const reviewPath = path.join(processed.reviewDirectory, "review-record.json");
    const reviewReference = relativePath(options.repositoryRoot, reviewPath);
    const candidateReference = relativePath(options.repositoryRoot, candidatePath);
    const request = derivePromotionRequest({
      candidate: options.candidate,
      review: processed.record,
      reviewReference,
      candidateReference,
    });
    await writeJsonAtomic(promotionPath, request);
    await mkdir(path.dirname(admissionPath), { recursive: true, mode: 0o700 });
    const promotion = await options.dependencies.promoteIntake({
      repositoryRoot: options.repositoryRoot,
      inputPath: promotionPath,
      outputPath: admissionPath,
      write: true,
    });
    const result: CandidateResult = {
      candidate_id: options.candidate.id,
      identity: options.candidate.identity,
      status: facts.failed ? "failed" : "completed",
      error: null,
      intake: facts,
      promotion: {
        completed: true,
        admission_state: promotion.decision.state,
        listing_id: typeof promotion.record.id === "string" ? promotion.record.id : options.candidate.id,
        record_path: relativePath(options.repositoryRoot, admissionPath),
        reused_existing: promotion.reusedExisting,
        provenance_status: isRecord(promotion.record.evidence)
          ? stringField(promotion.record.evidence, "provenance_status")
          : null,
      },
    };
    await writeJsonAtomic(path.join(candidateRoot, "result.json"), result);
    return result;
  } catch (error) {
    const result: CandidateResult = {
      candidate_id: options.candidate.id,
      identity: options.candidate.identity,
      status: "failed",
      error: redact(error),
      intake: facts,
      promotion: {
        completed: false,
        admission_state: null,
        listing_id: null,
        record_path: null,
        reused_existing: false,
        provenance_status: null,
      },
    };
    if (options.write) await writeJsonAtomic(path.join(candidateRoot, "result.json"), result);
    return result;
  }
}

async function runDryCandidate(options: {
  repositoryRoot: string;
  candidate: BatchCandidate;
  dependencies: OrchestratorDependencies;
}): Promise<CandidateResult> {
  const dryRoot = await import("node:fs/promises").then(({ mkdtemp }) => (
    mkdtemp(path.join(process.env.TMPDIR ?? "/tmp", "weft-place-ingestion-preview-"))
  ));
  const remove = await import("node:fs/promises").then(({ rm }) => rm);
  let facts = emptyIntake();
  try {
    const manifestPath = path.join(dryRoot, "intake-manifest.json");
    const candidatePath = path.join(dryRoot, "candidate.json");
    const intakeRoot = path.join(dryRoot, "intake");
    const promotionPath = path.join(dryRoot, "promotion-request.json");
    const admissionPath = path.join(dryRoot, "admission", `${options.candidate.id}.json`);
    await writeJsonAtomic(manifestPath, { manifest_version: "1.0", submissions: [options.candidate.submission] });
    await writeJsonAtomic(candidatePath, {
      candidate_id: options.candidate.id,
      immutable_identity: options.candidate.identity,
      discovery_candidate: options.candidate.discovery,
      intake_submission: options.candidate.submission,
    });
    const intake = await options.dependencies.runIntake({
      manifestPath,
      repositoryRoot: options.repositoryRoot,
      outputRoot: intakeRoot,
      dryRun: false,
      now: () => options.candidate.evidenceTime,
    });
    const processed = intake.processed[0];
    if (!processed?.reviewDirectory) throw new OrchestrationError("Intake preview did not produce temporary evidence.");
    facts = reviewFacts(options.candidate, processed, intake.failedCount > 0);
    const reviewPath = path.join(processed.reviewDirectory, "review-record.json");
    const reviewReference = path.relative(dryRoot, reviewPath).split(path.sep).join("/");
    const candidateReference = path.relative(dryRoot, candidatePath).split(path.sep).join("/");
    await writeJsonAtomic(promotionPath, derivePromotionRequest({
      candidate: options.candidate,
      review: processed.record,
      reviewReference,
      candidateReference,
    }));
    const promotion = await options.dependencies.promoteIntake({
      repositoryRoot: dryRoot,
      inputPath: promotionPath,
      outputPath: admissionPath,
      write: false,
    });
    return {
      candidate_id: options.candidate.id,
      identity: options.candidate.identity,
      status: facts.failed ? "failed" : "completed",
      error: null,
      intake: facts,
      promotion: {
        completed: true,
        admission_state: promotion.decision.state,
        listing_id: typeof promotion.record.id === "string" ? promotion.record.id : options.candidate.id,
        record_path: null,
        reused_existing: false,
        provenance_status: isRecord(promotion.record.evidence)
          ? stringField(promotion.record.evidence, "provenance_status")
          : null,
      },
    };
  } catch (error) {
    return {
      candidate_id: options.candidate.id,
      identity: options.candidate.identity,
      status: "failed",
      error: redact(error),
      intake: facts,
      promotion: {
        completed: false,
        admission_state: null,
        listing_id: null,
        record_path: null,
        reused_existing: false,
        provenance_status: null,
      },
    };
  } finally {
    await remove(dryRoot, { recursive: true, force: true });
  }
}

async function mapConcurrent<T, R>(values: T[], concurrency: number, task: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await task(values[index]!);
    }
  }));
  return results;
}

async function listFiles(root: string, current = root): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const candidate = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, candidate));
    else if (entry.isFile()) files.push(path.relative(root, candidate).split(path.sep).join("/"));
  }
  return files;
}

async function protectedSnapshot(repositoryRoot: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();
  for (const directory of protectedRoots) {
    const root = path.join(repositoryRoot, directory);
    for (const relative of await listFiles(root)) {
      snapshot.set(`${directory}/${relative}`, digest(await readFile(path.join(root, ...relative.split("/")))));
    }
  }
  return snapshot;
}

function snapshotDifferences(before: Map<string, string>, after: Map<string, string>): number {
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].filter((key) => before.get(key) !== after.get(key)).length;
}

async function assertWorkspacePath(repositoryRoot: string, runRoot: string): Promise<void> {
  const root = path.resolve(repositoryRoot);
  const output = path.resolve(runRoot);
  const relative = path.relative(root, output).split(path.sep);
  if (!inside(root, output) || relative.length !== 2 || relative[0] !== "ingestion-workspace") {
    throw new OrchestrationError("Batch output must use ingestion-workspace/<run-id> inside the repository.");
  }
  let current = root;
  for (const segment of relative) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new OrchestrationError("Batch output path contains a symbolic link.");
    } catch (error) {
      if (error instanceof OrchestrationError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw new OrchestrationError("Batch output path could not be inspected safely.");
    }
  }
}

async function copyAdmission(source: string, target: string): Promise<"copied" | "reused" | "collision"> {
  const bytes = await readFile(source);
  try {
    const existing = await readFile(target);
    return digest(existing) === digest(bytes) ? "reused" : "collision";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  return "copied";
}

async function registryPreview(options: {
  repositoryRoot: string;
  runRoot: string;
  results: CandidateResult[];
  generatedAt: string;
  generation: number;
  dependencies: OrchestratorDependencies;
}): Promise<{ preview: NonNullable<BatchSummary["registry_preview"]>; collisions: number }> {
  const previewRoot = options.generation === 1
    ? path.join(options.runRoot, "registry-preview")
    : path.join(options.runRoot, "registry-preview-attempts", `attempt-${options.generation}`);
  const previewAdmissions = path.join(previewRoot, "admissions");
  await mkdir(previewAdmissions, { recursive: true, mode: 0o700 });
  let collisions = 0;
  const productionAdmissions = path.join(options.repositoryRoot, "admissions", "package-independent");
  for (const name of await listFiles(productionAdmissions)) {
    if (!name.endsWith(".json") || name.includes("/")) continue;
    if (await copyAdmission(path.join(productionAdmissions, name), path.join(previewAdmissions, name)) === "collision") {
      collisions += 1;
    }
  }
  for (const result of options.results.filter((item) => item.promotion.completed)) {
    const source = result.promotion.record_path
      ? path.resolve(options.repositoryRoot, ...result.promotion.record_path.split("/"))
      : path.join(options.runRoot, "candidates", result.candidate_id, "admission", `${result.candidate_id}.json`);
    const target = path.join(previewAdmissions, `${result.candidate_id}.json`);
    if (await copyAdmission(source, target) === "collision") collisions += 1;
  }
  const built = await options.dependencies.buildRegistry({
    repositoryRoot: options.repositoryRoot,
    admissionsRoot: previewAdmissions,
    validatePackage: options.dependencies.validatePackage,
    generatedAt: options.generatedAt,
  });
  const outputRoot = path.join(previewRoot, "output");
  await options.dependencies.writeRegistryOutput(outputRoot, built.registry, built.rejected);
  return {
    preview: {
      package_backed_candidates: built.discoveredCount,
      admission_candidates: built.discoveredListingCount,
      listed_total: built.registry.workflow_count,
      package_independent_listed: built.registry.workflows.filter((item) => item.listing_source === "package_independent").length,
      needs_review: built.rejected.listings.filter((item) => item.admission_state === "needs_review").length,
      quarantined: built.rejected.listings.filter((item) => item.admission_state === "quarantined").length,
      output_directory: relativePath(options.repositoryRoot, path.join(outputRoot, "registry")),
    },
    collisions,
  };
}

function countBy(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right, "en")));
}

function createSummary(options: {
  runId: string;
  inputHash: string;
  write: boolean;
  supplied: number;
  selected: number;
  attempted: number;
  skipped: number;
  duplicateIdentities: number;
  results: CandidateResult[];
  state: RunState | null;
  resume: boolean;
  protectedWrites: number;
  preview: BatchSummary["registry_preview"];
  collisions: number;
}): BatchSummary {
  const completed = options.results.filter((item) => item.status === "completed");
  const artifactHashes = options.results.map((item) => item.intake.artifact_sha256).filter((value): value is string => Boolean(value));
  const duplicateHashCount = artifactHashes.length - new Set(artifactHashes).size;
  const operational: Record<OperationalState, number> = { pending: 0, processing: 0, completed: 0, failed: 0 };
  if (options.state) {
    for (const value of Object.values(options.state.candidates)) operational[value.status] += 1;
  } else {
    operational.completed = completed.length;
    operational.failed = options.results.length - completed.length;
  }
  const admissionStates = countBy(options.results
    .map((item) => item.promotion.admission_state)
    .filter((value): value is AdmissionState => value !== null));
  return {
    summary_version: "1.0",
    run_id: options.runId,
    input_hash: options.inputHash,
    mode: options.write ? "write" : "dry_run",
    candidates_supplied: options.supplied,
    candidates_selected: options.selected,
    candidates_attempted: options.attempted,
    candidates_skipped_completed: options.skipped,
    operational_states: operational,
    intake_completed: options.results.filter((item) => item.intake.completed).length,
    intake_failed: options.results.filter((item) => item.intake.failed).length,
    admission_promotion_completed: options.results.filter((item) => item.promotion.completed).length,
    staged_admission_states: {
      listed: admissionStates.listed ?? 0,
      needs_review: admissionStates.needs_review ?? 0,
      quarantined: admissionStates.quarantined ?? 0,
    },
    artifact_retrieval_failures: options.results.filter((item) => item.intake.resolution_status === "failed").length,
    parse_failures: options.results.filter((item) => (
      item.intake.resolution_status === "resolved" && item.intake.parsing_status !== "parsed"
    )).length,
    secret_findings: options.results.reduce((sum, item) => sum + item.intake.secret_finding_count, 0),
    license_evidence_outcomes: countBy(options.results.map((item) => item.intake.repository_license_status)),
    provenance_completeness: countBy(options.results.map((item) => item.promotion.provenance_status ?? "unknown")),
    immutable_reference_preserved: options.results.filter((item) => item.intake.immutable_reference_preserved).length,
    duplicates: {
      immutable_identity: options.duplicateIdentities,
      artifact_hash: duplicateHashCount,
      source: options.results.filter((item) => item.intake.duplicate_source).length,
    },
    collisions: options.collisions,
    retries: options.state
      ? Object.values(options.state.candidates).reduce((sum, item) => sum + Math.max(0, item.attempts - 1), 0)
      : 0,
    resumability_exercised: options.resume && (
      options.skipped > 0
      || (options.state
        ? Object.values(options.state.candidates).some((item) => item.attempts > 1)
        : false)
    ),
    protected_directory_writes: options.protectedWrites,
    imported_workflow_executions: 0,
    registry_preview: options.preview,
    candidates: [...options.results].sort((left, right) => (
      left.identity.localeCompare(right.identity, "en") || left.candidate_id.localeCompare(right.candidate_id, "en")
    )),
  };
}

export function formatSummary(summary: BatchSummary): string {
  const preview = summary.registry_preview;
  return [
    "Weft Place Batch Ingestion",
    "",
    `Mode: ${summary.mode === "write" ? "WORKSPACE WRITE" : "DRY RUN"}`,
    `Run: ${summary.run_id}`,
    `Candidates supplied / selected / attempted: ${summary.candidates_supplied} / ${summary.candidates_selected} / ${summary.candidates_attempted}`,
    `Intake completed / failed: ${summary.intake_completed} / ${summary.intake_failed}`,
    `Promotion completed: ${summary.admission_promotion_completed}`,
    `Staged states — Listed: ${summary.staged_admission_states.listed}, Needs Review: ${summary.staged_admission_states.needs_review}, Quarantined: ${summary.staged_admission_states.quarantined}`,
    `Retrieval failures / parse failures / secret findings: ${summary.artifact_retrieval_failures} / ${summary.parse_failures} / ${summary.secret_findings}`,
    `Immutable references preserved: ${summary.immutable_reference_preserved}`,
    `Duplicates / collisions: ${summary.duplicates.immutable_identity + summary.duplicates.artifact_hash + summary.duplicates.source} / ${summary.collisions}`,
    `Retries: ${summary.retries}`,
    `Resumability exercised: ${summary.resumability_exercised ? "yes" : "no"}`,
    `Protected-directory writes: ${summary.protected_directory_writes}`,
    `Imported Workflow executions: ${summary.imported_workflow_executions}`,
    ...(preview ? [
      `Registry preview: ${preview.listed_total} Listed total (${preview.package_independent_listed} package-independent), ${preview.needs_review} Needs Review, ${preview.quarantined} Quarantined`,
      `Preview output: ${preview.output_directory}`,
    ] : []),
    "",
    "Listed is an inclusion state only; it is not a safety, compatibility, runtime, production-readiness, quality, or recommendation claim.",
  ].join("\n");
}

async function existingResult(runRoot: string, candidate: BatchCandidate): Promise<CandidateResult | null> {
  const filePath = path.join(runRoot, "candidates", candidate.id, "result.json");
  try {
    const value = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    return isRecord(value)
      && value.status === "completed"
      && (!isRecord(value.intake) || value.intake.failed !== true)
      ? value as unknown as CandidateResult
      : null;
  } catch {
    return null;
  }
}

export async function loadDefaultDependencies(): Promise<OrchestratorDependencies> {
  const runningBuiltOutput = new URL(".", import.meta.url).pathname.endsWith("/dist/");
  const intakePath = new URL(
    runningBuiltOutput ? "../../intake/dist/index.js" : "../../intake/src/index.ts",
    import.meta.url,
  ).href;
  const promotionPath = new URL(
    runningBuiltOutput ? "../../registry-builder/dist/promote-intake.js" : "../../registry-builder/src/promote-intake.ts",
    import.meta.url,
  ).href;
  const builderPath = new URL(
    runningBuiltOutput ? "../../registry-builder/dist/build-registry.js" : "../../registry-builder/src/build-registry.ts",
    import.meta.url,
  ).href;
  const outputPath = new URL(
    runningBuiltOutput ? "../../registry-builder/dist/write-output.js" : "../../registry-builder/src/write-output.ts",
    import.meta.url,
  ).href;
  const validatorPath = new URL(
    runningBuiltOutput ? "../../../validator/dist/index.js" : "../../../validator/src/index.ts",
    import.meta.url,
  ).href;
  const [intake, promotion, builder, output, validator] = await Promise.all([
    import(intakePath),
    import(promotionPath),
    import(builderPath),
    import(outputPath),
    import(validatorPath),
  ]);
  const github = new intake.GitHubClient({
    token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
    fetch: createMemoizedGitHubFetch(),
  });
  return {
    loadSubmissionManifest: intake.loadSubmissionManifest as OrchestratorDependencies["loadSubmissionManifest"],
    runIntake: ((options: JsonRecord) => intake.runIntake({ ...options, github })) as OrchestratorDependencies["runIntake"],
    promoteIntake: promotion.promoteIntake as OrchestratorDependencies["promoteIntake"],
    buildRegistry: builder.buildRegistry as OrchestratorDependencies["buildRegistry"],
    writeRegistryOutput: output.writeOutput as OrchestratorDependencies["writeRegistryOutput"],
    validatePackage: validator.validatePackage as OrchestratorDependencies["validatePackage"],
  };
}

export async function runBatch(options: BatchOptions): Promise<BatchSummary> {
  const repositoryRoot = await realpath(path.resolve(options.repositoryRoot));
  const dependencies = options.dependencies ?? await loadDefaultDependencies();
  const loaded = await loadBatch(options.inputPath, dependencies);
  const runId = options.runId ?? `ingest-${loaded.inputHash.slice(0, 12)}`;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(runId)) throw new OrchestrationError("Run id must use lowercase letters, digits, and hyphens.");
  const concurrency = options.concurrency ?? 4;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new OrchestrationError("Concurrency must be an integer from 1 through 8.");
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100)) {
    throw new OrchestrationError("Limit must be an integer from 1 through 100.");
  }
  const selected = options.limit ? loaded.candidates.slice(0, options.limit) : loaded.candidates;
  const before = await protectedSnapshot(repositoryRoot);
  const runRoot = path.join(repositoryRoot, "ingestion-workspace", runId);
  let state: RunState | null = null;
  const priorResults = new Map<string, CandidateResult>();

  if (options.write) {
    await assertWorkspacePath(repositoryRoot, runRoot);
    let exists = false;
    try { exists = (await stat(runRoot)).isDirectory(); } catch { /* new run */ }
    if (exists && !options.resume) {
      throw new OrchestrationError("Batch workspace already exists; use --resume to continue it safely.");
    }
    if (exists) {
      const existing = await readJson(path.join(runRoot, "state.json"));
      if (!isRecord(existing) || existing.input_hash !== loaded.inputHash || existing.run_id !== runId) {
        throw new OrchestrationError("Existing batch state does not match the current immutable input.");
      }
      state = existing as unknown as RunState;
      for (const candidate of selected) {
        const result = await existingResult(runRoot, candidate);
        if (result) priorResults.set(candidate.id, result);
      }
    } else {
      await mkdir(path.join(runRoot, "candidates"), { recursive: true, mode: 0o700 });
      state = {
        state_version: "1.0",
        run_id: runId,
        input_hash: loaded.inputHash,
        candidate_order: loaded.candidates.map((candidate) => candidate.id),
        candidates: Object.fromEntries(loaded.candidates.map((candidate) => [
          candidate.id,
          { status: "pending" as const, attempts: 0 },
        ])),
      };
    }
  }

  const attemptedCandidates = selected.filter((candidate) => !priorResults.has(candidate.id));
  const attemptNumbers = new Map<string, number>();
  if (state) {
    for (const candidate of attemptedCandidates) {
      const current = state.candidates[candidate.id] ?? { status: "pending" as const, attempts: 0 };
      state.candidates[candidate.id] = { status: "processing", attempts: current.attempts + 1 };
      attemptNumbers.set(candidate.id, current.attempts + 1);
    }
    for (const [id] of priorResults) state.candidates[id] = { ...state.candidates[id]!, status: "completed" };
    await writeJsonAtomic(path.join(runRoot, "state.json"), state);
  }

  const newResults = await mapConcurrent(attemptedCandidates, concurrency, (candidate) => (
    options.write
      ? runCandidate({
          repositoryRoot,
          runRoot,
          candidate,
          write: true,
          attempt: attemptNumbers.get(candidate.id) ?? 1,
          dependencies,
        })
      : runDryCandidate({ repositoryRoot, candidate, dependencies })
  ));
  const results = [...priorResults.values(), ...newResults].sort((left, right) => (
    left.identity.localeCompare(right.identity, "en") || left.candidate_id.localeCompare(right.candidate_id, "en")
  ));
  if (state) {
    for (const result of newResults) {
      state.candidates[result.candidate_id] = {
        ...state.candidates[result.candidate_id]!,
        status: result.status,
      };
    }
    await writeJsonAtomic(path.join(runRoot, "state.json"), state);
  }

  let preview: BatchSummary["registry_preview"] = null;
  let collisions = 0;
  if (options.write && (options.registryPreview ?? true)) {
    const generatedAt = loaded.candidates[0]?.evidenceTime;
    if (!generatedAt) throw new OrchestrationError("Registry preview lacks a recorded evidence timestamp.");
    const previewResult = await registryPreview({
      repositoryRoot,
      runRoot,
      results,
      generatedAt,
      generation: state
        ? Math.max(1, ...Object.values(state.candidates).map((item) => item.attempts))
        : 1,
      dependencies,
    });
    preview = previewResult.preview;
    collisions = previewResult.collisions;
  }
  const after = await protectedSnapshot(repositoryRoot);
  const protectedWrites = snapshotDifferences(before, after);
  const summary = createSummary({
    runId,
    inputHash: loaded.inputHash,
    write: options.write,
    supplied: loaded.candidates.length,
    selected: selected.length,
    attempted: attemptedCandidates.length,
    skipped: priorResults.size,
    duplicateIdentities: loaded.duplicateIdentities,
    results,
    state,
    resume: options.resume ?? false,
    protectedWrites,
    preview,
    collisions,
  });
  if (options.write) {
    await writeJsonAtomic(path.join(runRoot, "summary.json"), summary);
    await writeFile(path.join(runRoot, "summary.txt"), `${formatSummary(summary)}\n`, { encoding: "utf8", mode: 0o600 });
  }
  if (protectedWrites > 0) throw new OrchestrationError("Protected repository content changed during batch orchestration.");
  return summary;
}
