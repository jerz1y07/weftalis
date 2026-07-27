import { createHash } from "node:crypto";
import path from "node:path";

import { detectDuplicates, loadExistingReviews, toIndexEntry } from "./duplicates.js";
import { fingerprintArtifact } from "./fingerprint.js";
import {
  GitHubClient,
  IntakeSourceError,
  normalizeGitHubRepositoryUrl,
  type RepositoryMetadata,
} from "./github.js";
import { createUnavailableAudit, parseArtifact } from "./parser.js";
import { assertSafeOutputRoot, writeReview } from "./output.js";
import { loadSubmissionManifest } from "./schema-validator.js";
import type {
  CommunitySubmission,
  LicenseEvidence,
  ModerationStatus,
  RequestedRefKind,
  ResolvedUpstreamArtifact,
  ReviewRecord,
} from "./types.js";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, nested]) => [key, stableValue(nested)]),
  );
}

function slug(value: string): string {
  const result = value.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return result || "workflow";
}

function reviewId(submission: CommunitySubmission, commit: string | null, failureCode: string | null): string {
  const stable = JSON.stringify(stableValue({ submission, commit, failureCode }));
  const suffix = createHash("sha256").update(stable).digest("hex").slice(0, 16);
  return `${slug(submission.workflow_name)}-${suffix}`;
}

function requestedRef(submission: CommunitySubmission): {
  kind: RequestedRefKind;
  value: string | null;
  was_mutable: boolean;
} {
  if (submission.commit) return { kind: "commit", value: submission.commit.toLowerCase(), was_mutable: false };
  if (submission.branch) return { kind: "branch", value: submission.branch, was_mutable: true };
  if (submission.tag) return { kind: "tag", value: submission.tag, was_mutable: true };
  return { kind: "default_branch", value: null, was_mutable: true };
}

function unavailableLicense(claim: string | undefined): LicenseEvidence {
  return {
    submission_claim: claim ?? null,
    repository_level: {
      status: "unavailable",
      spdx_id: null,
      name: null,
      path: null,
      git_blob_sha: null,
      evidence_url: null,
      scope: "repository-level",
      limitations: ["Repository-level license evidence could not be pinned and retrieved."],
    },
    file_level: {
      status: "not_scanned",
      spdx_identifiers: [],
      method: "The artifact was unavailable.",
      limitations: ["No file-level license header scan was possible."],
    },
    limitations: [
      "A submitter's license claim is not independent evidence.",
      "No license status authorizes automatic publication.",
    ],
  };
}

function moderation(
  now: string,
  fetched: boolean,
  parsed: boolean,
  quarantined: boolean,
  quarantineReason: string | null,
): ModerationStatus {
  const history: ModerationStatus["history"] = [
    { status: "submitted", at: now, actor: "intake-cli", reason: "Submission manifest accepted for local intake." },
    { status: "resolving", at: now, actor: "intake-cli", reason: "Resolving the requested GitHub ref and exact artifact path." },
  ];
  if (fetched) {
    history.push({ status: "fetched", at: now, actor: "intake-cli", reason: "Exact upstream bytes were retrieved and fingerprinted." });
  }
  if (parsed) {
    history.push({ status: "parsed", at: now, actor: "intake-cli", reason: "Static parsing completed without executing the artifact." });
  }
  if (quarantined) {
    history.push({
      status: "quarantined",
      at: now,
      actor: "intake-cli",
      reason: quarantineReason ?? "Conservative static review requires quarantine.",
    });
  } else {
    history.push({
      status: "needs_review",
      at: now,
      actor: "intake-cli",
      reason: "Automated intake stops for human moderation and cannot publish.",
    });
  }
  return {
    record_version: "1.0",
    current_status: quarantined ? "quarantined" : "needs_review",
    automatic_publication: false,
    history,
    human_decision: null,
  };
}

function artifactText(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export interface ProcessedSubmission {
  record: ReviewRecord;
  reviewDirectory: string | null;
  reusedExisting: boolean;
}

export interface IntakeRunResult {
  dryRun: boolean;
  outputRoot: string;
  processed: ProcessedSubmission[];
  failedCount: number;
}

export interface IntakeRunOptions {
  manifestPath: string;
  repositoryRoot: string;
  outputRoot?: string;
  dryRun?: boolean;
  github?: GitHubClient;
  now?: () => string;
}

export async function runIntake(options: IntakeRunOptions): Promise<IntakeRunResult> {
  const manifest = await loadSubmissionManifest(options.manifestPath);
  const outputRoot = await assertSafeOutputRoot(
    options.repositoryRoot,
    options.outputRoot ?? path.join(options.repositoryRoot, "intake-review"),
  );
  const dryRun = options.dryRun ?? false;
  const github = options.github ?? new GitHubClient({ token: process.env.GITHUB_TOKEN });
  const now = options.now ?? (() => new Date().toISOString());
  const existing = await loadExistingReviews(outputRoot);
  const processed: ProcessedSubmission[] = [];
  let failedCount = 0;

  for (const submission of manifest.submissions) {
    const timestamp = now();
    const identity = normalizeGitHubRepositoryUrl(submission.repository_url);
    let repository: RepositoryMetadata | null = null;
    let resolvedCommit: string | null = null;
    let retrievedBytes: Uint8Array | null = null;
    let resolutionFailure: { code: string; message: string } | null = null;
    let resolvedArtifact: ResolvedUpstreamArtifact;
    let staticAudit;

    try {
      repository = await github.inspectRepository(identity);
      const ref = await github.resolveRef(submission, repository);
      resolvedCommit = ref.commit;
      const retrieved = await github.retrieveArtifact(repository, ref.commit, submission.artifact_path);
      retrievedBytes = retrieved.bytes;
      const fingerprint = fingerprintArtifact(retrieved.bytes, retrieved.reportedGitBlobSha);
      const licenseEvidence = await github.collectLicenseEvidence(
        repository,
        ref.commit,
        submission.license_claim,
        artifactText(retrieved.bytes),
      );
      if (fingerprint.git_blob_sha_matches === false) {
        resolutionFailure = {
          code: "artifact.git_blob_mismatch",
          message: "Calculated Git blob SHA does not match GitHub's reported blob identifier.",
        };
        failedCount += 1;
      }
      resolvedArtifact = {
        record_version: "1.0",
        resolution_status: resolutionFailure ? "failed" : "resolved",
        repository: {
          submitted_url: identity.submittedUrl,
          normalized_url: repository.identity.normalizedUrl,
          owner: repository.identity.owner,
          name: repository.identity.name,
        },
        requested_ref: {
          kind: ref.kind,
          value: ref.value,
          was_mutable: ref.wasMutable,
        },
        resolved_commit: ref.commit,
        artifact: {
          requested_path: submission.artifact_path,
          verified_case_sensitive_path: retrieved.verifiedPath,
          contents_api_url: retrieved.contentsApiUrl,
          raw_url: retrieved.rawUrl,
          stored_path: null,
        },
        fingerprint,
        retrieved_at: timestamp,
        license_evidence: licenseEvidence,
        failure: resolutionFailure,
        warnings: [
          ...(ref.wasMutable ? ["The submitted mutable ref was recorded and resolved to an immutable commit."] : []),
          ...(licenseEvidence.repository_level.status !== "found"
            ? ["Repository-level license evidence is missing, ambiguous, or unavailable."]
            : []),
          ...(licenseEvidence.file_level.status !== "found"
            ? ["No unambiguous file-level SPDX license header was detected."]
            : []),
        ],
      };
      staticAudit = parseArtifact(retrieved.bytes, submission.platform_hint);
      if (resolutionFailure) staticAudit.recommended_moderation_status = "quarantined";
    } catch (error) {
      const sourceError = error instanceof IntakeSourceError
        ? error
        : new IntakeSourceError("intake.unexpected_source_error", "The upstream source could not be resolved safely.");
      resolutionFailure = { code: sourceError.code, message: sourceError.message };
      failedCount += 1;
      let licenseEvidence = unavailableLicense(submission.license_claim);
      if (repository && resolvedCommit) {
        licenseEvidence = await github.collectLicenseEvidence(
          repository,
          resolvedCommit,
          submission.license_claim,
          null,
        );
      }
      const ref = requestedRef(submission);
      if (ref.kind === "default_branch" && repository) ref.value = repository.defaultBranch;
      resolvedArtifact = {
        record_version: "1.0",
        resolution_status: "failed",
        repository: {
          submitted_url: identity.submittedUrl,
          normalized_url: repository?.identity.normalizedUrl ?? identity.normalizedUrl,
          owner: repository?.identity.owner ?? identity.owner,
          name: repository?.identity.name ?? identity.name,
        },
        requested_ref: ref,
        resolved_commit: resolvedCommit,
        artifact: {
          requested_path: submission.artifact_path,
          verified_case_sensitive_path: null,
          contents_api_url: null,
          raw_url: null,
          stored_path: null,
        },
        fingerprint: null,
        retrieved_at: null,
        license_evidence: licenseEvidence,
        failure: resolutionFailure,
        warnings: ["The artifact could not be retrieved and must not proceed without human investigation."],
      };
      staticAudit = createUnavailableAudit(submission.platform_hint);
    }

    const quarantined = Boolean(resolutionFailure)
      || staticAudit.recommended_moderation_status === "quarantined";
    const id = reviewId(submission, resolvedArtifact.resolved_commit, resolutionFailure?.code ?? null);
    const record: ReviewRecord = {
      record_version: "1.0",
      review_id: id,
      created_at: timestamp,
      original_submission: submission,
      resolved_artifact: resolvedArtifact,
      static_audit: staticAudit,
      duplicate_status: {
        duplicate_artifact: false,
        artifact_matches: [],
        duplicate_source: false,
        source_matches: [],
      },
      moderation: moderation(
        timestamp,
        retrievedBytes !== null,
        staticAudit.parsing_status === "parsed",
        quarantined,
        resolutionFailure?.message
          ?? (staticAudit.secret_scan.finding_count > 0 ? "Potential secret-like values require quarantine and manual inspection." : null),
      ),
      warnings: [...resolvedArtifact.warnings, ...staticAudit.warnings],
      uncertainties: [
        ...staticAudit.uncertainties,
        "License, authorship, runtime behavior, compatibility, usefulness, and safety require human review.",
      ],
    };
    record.duplicate_status = detectDuplicates(record, existing);
    if (record.duplicate_status.duplicate_artifact) {
      record.warnings.push("The artifact SHA-256 matches one or more existing local review records.");
    }
    if (record.duplicate_status.duplicate_source) {
      record.warnings.push("The repository, exact artifact path, and pinned commit match an existing local review record.");
    }
    const written = await writeReview(outputRoot, record, retrievedBytes, dryRun);
    processed.push({ record, ...written });
    existing.push(toIndexEntry(record));
  }

  return { dryRun, outputRoot, processed, failedCount };
}
