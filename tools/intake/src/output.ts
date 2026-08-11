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

function isMissingPath(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT",
  );
}

async function assertNoSymlinkComponents(
  trustedRoot: string,
  candidate: string,
  allowMissing: boolean,
): Promise<void> {
  const absoluteRoot = path.resolve(trustedRoot);
  const absoluteCandidate = path.resolve(candidate);
  if (!isInside(absoluteRoot, absoluteCandidate)) {
    throw new IntakeValidationError("The review output path escapes the approved intake review root.");
  }

  const relative = path.relative(absoluteRoot, absoluteCandidate);
  const components = relative === "" ? [] : relative.split(path.sep);
  let current = absoluteRoot;
  for (const component of ["", ...components]) {
    if (component) current = path.join(current, component);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        throw new IntakeValidationError("The review output path contains a symbolic link and was rejected.");
      }
      if (component && current !== absoluteCandidate && !metadata.isDirectory()) {
        throw new IntakeValidationError("A review output ancestor is not a directory.");
      }
    } catch (error) {
      if (error instanceof IntakeValidationError) throw error;
      if (isMissingPath(error) && allowMissing) return;
      throw new IntakeValidationError("The review output path could not be verified safely.");
    }
  }
}

async function resolveThroughExistingAncestor(candidate: string): Promise<string> {
  let current = path.resolve(candidate);
  const suffix: string[] = [];
  while (true) {
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        throw new IntakeValidationError("The review output root or an existing ancestor is a symbolic link.");
      }
      const existing = await realpath(current);
      if (existing !== current) {
        throw new IntakeValidationError("The review output root resolves through a symbolic-link ancestor.");
      }
      return path.join(existing, ...suffix.reverse());
    } catch (error) {
      if (error instanceof IntakeValidationError) throw error;
      if (!isMissingPath(error)) {
        throw new IntakeValidationError("The review output root could not be resolved safely.");
      }
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
  const requestedAbsolute = path.resolve(requestedOutputRoot);
  if (isInside(realRepositoryRoot, requestedAbsolute)) {
    await assertNoSymlinkComponents(realRepositoryRoot, requestedAbsolute, true);
  }
  const outputRoot = await resolveThroughExistingAncestor(requestedAbsolute);
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

export async function assertContainedReviewPath(
  outputRoot: string,
  candidate: string,
  allowMissing = false,
): Promise<void> {
  const absoluteRoot = path.resolve(outputRoot);
  const absoluteCandidate = path.resolve(candidate);
  await assertNoSymlinkComponents(absoluteRoot, absoluteCandidate, allowMissing);

  let realRoot: string;
  try {
    realRoot = await realpath(absoluteRoot);
  } catch (error) {
    if (isMissingPath(error) && allowMissing) return;
    throw new IntakeValidationError("The approved intake review root could not be verified safely.");
  }
  if (realRoot !== absoluteRoot) {
    throw new IntakeValidationError("The approved intake review root resolves through a symbolic link.");
  }

  try {
    const realCandidate = await realpath(absoluteCandidate);
    if (!isInside(realRoot, realCandidate)) {
      throw new IntakeValidationError("The review output path escapes the approved intake review root.");
    }
  } catch (error) {
    if (error instanceof IntakeValidationError) throw error;
    if (isMissingPath(error) && allowMissing) return;
    throw new IntakeValidationError("The review output path could not be resolved safely.");
  }
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

async function verifyExistingReview(
  outputRoot: string,
  reviewDirectory: string,
  record: ReviewRecord,
  bytes: Uint8Array | null,
): Promise<void> {
  await assertContainedReviewPath(outputRoot, reviewDirectory);
  const reviewRecordPath = path.join(reviewDirectory, "review-record.json");
  await assertContainedReviewPath(outputRoot, reviewRecordPath);
  const existingText = await readFile(reviewRecordPath, "utf8");
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
    const storedPath = path.join(reviewDirectory, ...relativeArtifact.split("/"));
    await assertContainedReviewPath(outputRoot, storedPath);
    const stored = await readFile(storedPath);
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

  await assertContainedReviewPath(outputRoot, outputRoot, true);
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  await assertContainedReviewPath(outputRoot, outputRoot);
  const reviewsDirectory = path.join(outputRoot, "reviews");
  await assertContainedReviewPath(outputRoot, reviewsDirectory, true);
  await mkdir(reviewsDirectory, { recursive: true, mode: 0o700 });
  await assertContainedReviewPath(outputRoot, reviewsDirectory);
  const reviewDirectory = path.join(reviewsDirectory, record.review_id);
  await assertContainedReviewPath(outputRoot, reviewDirectory, true);
  try {
    const existing = await lstat(reviewDirectory);
    if (!existing.isDirectory() || existing.isSymbolicLink()) {
      throw new IntakeValidationError("The target review path already exists and is not a directory.");
    }
    await verifyExistingReview(outputRoot, reviewDirectory, record, bytes);
    return { reviewDirectory, reusedExisting: true };
  } catch (error) {
    if (error instanceof IntakeValidationError) throw error;
    if (!isMissingPath(error)) {
      throw new IntakeValidationError("The target review path cannot be safely inspected.");
    }
  }

  await assertContainedReviewPath(outputRoot, reviewsDirectory);
  const staging = await mkdtemp(path.join(reviewsDirectory, ".staging-"));
  try {
    await assertContainedReviewPath(outputRoot, staging);
    if (bytes && relativeArtifact && record.resolved_artifact.fingerprint) {
      const artifactPath = path.join(staging, ...relativeArtifact.split("/"));
      await assertContainedReviewPath(outputRoot, artifactPath, true);
      await mkdir(path.dirname(artifactPath), { recursive: true, mode: 0o700 });
      await assertContainedReviewPath(outputRoot, path.dirname(artifactPath));
      await assertContainedReviewPath(outputRoot, artifactPath, true);
      await writeFile(artifactPath, bytes, { mode: 0o600 });
      await assertContainedReviewPath(outputRoot, artifactPath);
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
    const jsonFiles: Array<[string, unknown]> = [
      ["submission.json", record.original_submission],
      ["resolved-upstream-artifact.json", record.resolved_artifact],
      ["static-audit-result.json", record.static_audit],
      ["moderation-status.json", record.moderation],
      ["review-record.json", record],
    ];
    for (const [name, value] of jsonFiles) {
      const filePath = path.join(staging, name);
      await assertContainedReviewPath(outputRoot, filePath, true);
      await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await assertContainedReviewPath(outputRoot, filePath);
    }
    await assertContainedReviewPath(outputRoot, staging);
    await assertContainedReviewPath(outputRoot, reviewDirectory, true);
    await rename(staging, reviewDirectory);
    await assertContainedReviewPath(outputRoot, reviewDirectory);
    return { reviewDirectory, reusedExisting: false };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
