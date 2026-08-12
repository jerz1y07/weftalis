import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { assertContainedReviewPath } from "./output.js";
import { IntakeValidationError } from "./schema-validator.js";
import type {
  DuplicateStatus,
  ExistingReviewIndexEntry,
  ReviewRecord,
} from "./types.js";

function indexEntry(value: unknown): ExistingReviewIndexEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<ReviewRecord>;
  const resolved = record.resolved_artifact;
  if (!record.review_id || !resolved) return null;
  return {
    reviewId: record.review_id,
    sha256: resolved.fingerprint?.sha256 ?? null,
    normalizedRepository: resolved.repository.normalized_url,
    artifactPath: resolved.artifact.requested_path,
    commit: resolved.resolved_commit,
  };
}

export async function loadExistingReviews(outputRoot: string): Promise<ExistingReviewIndexEntry[]> {
  const reviewsDirectory = path.join(outputRoot, "reviews");
  try {
    const outputMetadata = await lstat(outputRoot);
    if (outputMetadata.isSymbolicLink() || !outputMetadata.isDirectory()) {
      throw new IntakeValidationError("The approved intake review root is not a safe directory.");
    }
    if (await realpath(outputRoot) !== path.resolve(outputRoot)) {
      throw new IntakeValidationError("The approved intake review root resolves through a symbolic link.");
    }
  } catch (error) {
    if (error instanceof IntakeValidationError) throw error;
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw new IntakeValidationError("The approved intake review root could not be inspected safely.");
  }
  await assertContainedReviewPath(outputRoot, reviewsDirectory, true);
  let entries;
  try {
    entries = await readdir(reviewsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw new IntakeValidationError("The existing reviews directory could not be read safely.");
  }
  const results: ExistingReviewIndexEntry[] = [];
  for (const entry of entries.slice(0, 10_000)) {
    if (!entry.isDirectory()) continue;
    const reviewDirectory = path.join(reviewsDirectory, entry.name);
    const reviewRecordPath = path.join(reviewDirectory, "review-record.json");
    await assertContainedReviewPath(outputRoot, reviewDirectory);
    try {
      const recordMetadata = await lstat(reviewRecordPath);
      if (recordMetadata.isSymbolicLink() || !recordMetadata.isFile()) {
        throw new IntakeValidationError("An existing review record is not a safe regular file.");
      }
      await assertContainedReviewPath(outputRoot, reviewRecordPath);
    } catch (error) {
      if (error instanceof IntakeValidationError) throw error;
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw new IntakeValidationError("An existing review record could not be inspected safely.");
    }
    try {
      const text = await readFile(reviewRecordPath, "utf8");
      if (text.length > 5 * 1024 * 1024) continue;
      const indexed = indexEntry(JSON.parse(text) as unknown);
      if (indexed) results.push(indexed);
    } catch (error) {
      if (error instanceof IntakeValidationError) throw error;
      // Invalid local review data is ignored here and remains visible for manual cleanup.
    }
  }
  return results;
}

export function detectDuplicates(
  record: ReviewRecord,
  existing: ExistingReviewIndexEntry[],
): DuplicateStatus {
  const fingerprint = record.resolved_artifact.fingerprint?.sha256 ?? null;
  const source = record.resolved_artifact;
  const candidates = existing.filter((item) => item.reviewId !== record.review_id);
  const artifactMatches = fingerprint
    ? candidates.filter((item) => item.sha256 === fingerprint).map((item) => item.reviewId)
    : [];
  const sourceMatches = source.resolved_commit
    ? candidates.filter((item) => (
      item.normalizedRepository.toLowerCase() === source.repository.normalized_url.toLowerCase()
      && item.artifactPath === source.artifact.requested_path
      && item.commit === source.resolved_commit
    )).map((item) => item.reviewId)
    : [];
  artifactMatches.sort((left, right) => left.localeCompare(right, "en"));
  sourceMatches.sort((left, right) => left.localeCompare(right, "en"));
  return {
    duplicate_artifact: artifactMatches.length > 0,
    artifact_matches: [...new Set(artifactMatches)],
    duplicate_source: sourceMatches.length > 0,
    source_matches: [...new Set(sourceMatches)],
  };
}

export function toIndexEntry(record: ReviewRecord): ExistingReviewIndexEntry {
  return {
    reviewId: record.review_id,
    sha256: record.resolved_artifact.fingerprint?.sha256 ?? null,
    normalizedRepository: record.resolved_artifact.repository.normalized_url,
    artifactPath: record.resolved_artifact.artifact.requested_path,
    commit: record.resolved_artifact.resolved_commit,
  };
}
