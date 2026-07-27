import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { sha256 } from "./fingerprint.js";
import { IntakeValidationError, schemaIds, validateAgainstSchema } from "./schema-validator.js";
import type { ReviewRecord } from "./types.js";

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (
    relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

async function resolveThroughExistingAncestor(candidate: string): Promise<string> {
  let current = path.resolve(candidate);
  const suffix: string[] = [];
  while (true) {
    try {
      const existing = await realpath(current);
      return path.join(existing, ...suffix.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(candidate);
      suffix.push(path.basename(current));
      current = parent;
    }
  }
}

export async function assertSafeOutputRoot(
  repositoryRoot: string,
  requestedOutputRoot: string,
): Promise<string> {
  const realRepositoryRoot = await realpath(repositoryRoot);
  const outputRoot = await resolveThroughExistingAncestor(requestedOutputRoot);
  const defaultLocalOutput = path.join(realRepositoryRoot, "intake-review");
  const protectedPaths = [
    realRepositoryRoot,
    path.join(realRepositoryRoot, "packages"),
    path.join(realRepositoryRoot, "registry"),
    path.join(realRepositoryRoot, "website"),
    path.join(realRepositoryRoot, ".git"),
  ];
  if (outputRoot === realRepositoryRoot) {
    throw new IntakeValidationError("The intake output directory cannot be the repository root.");
  }
  for (const protectedPath of protectedPaths.slice(1)) {
    if (isInside(protectedPath, outputRoot) || isInside(outputRoot, protectedPath)) {
      throw new IntakeValidationError(
        "The intake output directory must remain separate from Packages, Registry, website, and Git metadata.",
      );
    }
  }
  if (isInside(realRepositoryRoot, outputRoot) && outputRoot !== defaultLocalOutput) {
    throw new IntakeValidationError(
      "Inside the repository, intake output is restricted to the Git-ignored intake-review directory.",
    );
  }
  return outputRoot;
}

function artifactRelativePath(record: ReviewRecord): string | null {
  if (!record.resolved_artifact.fingerprint) return null;
  return path.posix.join("artifact", "upstream", record.original_submission.artifact_path);
}

async function validateRecord(record: ReviewRecord): Promise<void> {
  const issues = await validateAgainstSchema(schemaIds.reviewRecord, record);
  if (issues.length > 0) {
    throw new IntakeValidationError("Generated review data does not match its schema.", issues);
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

async function verifyExistingReview(
  reviewDirectory: string,
  record: ReviewRecord,
  bytes: Uint8Array | null,
): Promise<void> {
  const existingText = await readFile(path.join(reviewDirectory, "review-record.json"), "utf8");
  const existing = JSON.parse(existingText) as ReviewRecord;
  if (existing.review_id !== record.review_id) {
    throw new IntakeValidationError("An existing review directory has an unexpected review ID.");
  }
  const expectedHash = record.resolved_artifact.fingerprint?.sha256 ?? null;
  const existingHash = existing.resolved_artifact.fingerprint?.sha256 ?? null;
  if (existingHash !== expectedHash) {
    throw new IntakeValidationError("Rerun integrity verification failed: the fetched artifact hash changed.");
  }
  const relativeArtifact = existing.resolved_artifact.artifact.stored_path;
  if (bytes && relativeArtifact) {
    const stored = await readFile(path.join(reviewDirectory, ...relativeArtifact.split("/")));
    if (sha256(stored) !== expectedHash || sha256(bytes) !== expectedHash) {
      throw new IntakeValidationError("Rerun integrity verification failed for the stored artifact bytes.");
    }
  }
  record.resolved_artifact.artifact.stored_path = relativeArtifact;
  if (record.resolved_artifact.fingerprint && existing.resolved_artifact.fingerprint) {
    record.resolved_artifact.fingerprint.stored_artifact_sha256 = (
      existing.resolved_artifact.fingerprint.stored_artifact_sha256
    );
    record.resolved_artifact.fingerprint.stored_artifact_matches_fetched = (
      existing.resolved_artifact.fingerprint.stored_artifact_matches_fetched
    );
  }
}

export interface WriteReviewResult {
  reviewDirectory: string | null;
  reusedExisting: boolean;
}

export async function writeReview(
  outputRoot: string,
  record: ReviewRecord,
  bytes: Uint8Array | null,
  dryRun: boolean,
): Promise<WriteReviewResult> {
  const relativeArtifact = artifactRelativePath(record);
  record.resolved_artifact.artifact.stored_path = relativeArtifact;
  if (dryRun) {
    record.resolved_artifact.artifact.stored_path = null;
    await validateRecord(record);
    return { reviewDirectory: null, reusedExisting: false };
  }

  await mkdir(path.join(outputRoot, "reviews"), { recursive: true, mode: 0o700 });
  const reviewDirectory = path.join(outputRoot, "reviews", record.review_id);
  try {
    const existing = await lstat(reviewDirectory);
    if (!existing.isDirectory() || existing.isSymbolicLink()) {
      throw new IntakeValidationError("The target review path already exists and is not a directory.");
    }
    await verifyExistingReview(reviewDirectory, record, bytes);
    return { reviewDirectory, reusedExisting: true };
  } catch (error) {
    if (error instanceof IntakeValidationError) throw error;
    try {
      await lstat(reviewDirectory);
      throw new IntakeValidationError("The target review path cannot be safely reused.");
    } catch (nested) {
      if (nested instanceof IntakeValidationError) throw nested;
    }
  }

  const staging = await mkdtemp(path.join(outputRoot, "reviews", ".staging-"));
  try {
    if (bytes && relativeArtifact && record.resolved_artifact.fingerprint) {
      const artifactPath = path.join(staging, ...relativeArtifact.split("/"));
      await mkdir(path.dirname(artifactPath), { recursive: true, mode: 0o700 });
      await writeFile(artifactPath, bytes, { mode: 0o600 });
      const storedBytes = await readFile(artifactPath);
      const storedHash = sha256(storedBytes);
      record.resolved_artifact.fingerprint.stored_artifact_sha256 = storedHash;
      record.resolved_artifact.fingerprint.stored_artifact_matches_fetched = (
        storedHash === record.resolved_artifact.fingerprint.sha256
      );
      if (!record.resolved_artifact.fingerprint.stored_artifact_matches_fetched) {
        throw new IntakeValidationError("Stored artifact bytes do not match the fetched SHA-256.");
      }
    }
    await validateRecord(record);
    await writeJson(path.join(staging, "submission.json"), record.original_submission);
    await writeJson(path.join(staging, "resolved-upstream-artifact.json"), record.resolved_artifact);
    await writeJson(path.join(staging, "static-audit-result.json"), record.static_audit);
    await writeJson(path.join(staging, "moderation-status.json"), record.moderation);
    await writeJson(path.join(staging, "review-record.json"), record);
    await rename(staging, reviewDirectory);
    return { reviewDirectory, reusedExisting: false };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
