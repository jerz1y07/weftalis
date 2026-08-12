export { detectDuplicates, loadExistingReviews } from "./duplicates.js";
export { fingerprintArtifact, gitBlobSha1, sha256 } from "./fingerprint.js";
export { GitHubClient, IntakeSourceError, normalizeGitHubRepositoryUrl } from "./github.js";
export { runIntake } from "./intake.js";
export { createUnavailableAudit, parseArtifact } from "./parser.js";
export { createSchemaRegistry, loadSubmissionManifest, validateAgainstSchema } from "./schema-validator.js";
export type * from "./types.js";
