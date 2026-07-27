import { createHash } from "node:crypto";

import type { ArtifactFingerprint } from "./types.js";

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function gitBlobSha1(bytes: Uint8Array): string {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

export function countLines(bytes: Uint8Array): number {
  if (bytes.byteLength === 0) return 0;
  let newlines = 0;
  for (const byte of bytes) {
    if (byte === 0x0a) newlines += 1;
  }
  return bytes[bytes.byteLength - 1] === 0x0a ? newlines : newlines + 1;
}

export function fingerprintArtifact(
  bytes: Uint8Array,
  reportedGitBlobSha: string | null,
): ArtifactFingerprint {
  const calculatedGitBlobSha = gitBlobSha1(bytes);
  return {
    sha256: sha256(bytes),
    byte_size: bytes.byteLength,
    line_count: countLines(bytes),
    git_blob_sha_reported: reportedGitBlobSha,
    git_blob_sha_calculated: calculatedGitBlobSha,
    git_blob_sha_matches: reportedGitBlobSha === null
      ? null
      : reportedGitBlobSha.toLowerCase() === calculatedGitBlobSha,
    stored_artifact_sha256: null,
    stored_artifact_matches_fetched: null,
  };
}
