import path from "node:path";

import type {
  PublicIssue,
  RegistryEntry,
  ValidationIssue,
  ValidationReport,
  WorkflowManifest,
} from "./types.js";

export function toPosixRelative(repositoryRoot: string, targetPath: string): string {
  const relative = path.relative(repositoryRoot, targetPath);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Registry paths must remain inside the repository root.");
  }
  return relative.split(path.sep).join("/");
}

function redactSensitiveText(message: string): string {
  return message
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{8,}\b/g, "[REDACTED]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi, "Bearer [REDACTED]")
    .replace(/\b(password|api[_-]?key|token|secret)\s*[:=]\s*[^\s,;}]+/gi, "$1=[REDACTED]")
    .split("\n")[0] ?? "Validation error";
}

export function publicIssue(issue: ValidationIssue): PublicIssue {
  return {
    code: issue.code,
    message: redactSensitiveText(issue.message),
    file: issue.file ? issue.file.split(path.sep).join("/") : null,
    line: issue.line ?? null,
  };
}

export function normalizeEntry(
  manifest: WorkflowManifest,
  report: ValidationReport,
  repositoryRoot: string,
  packageRoot: string,
  checkedAt: string,
): RegistryEntry {
  const packagePath = toPosixRelative(repositoryRoot, packageRoot);
  const errors = report.issues.filter((issue) => issue.severity === "error").map(publicIssue);
  const warnings = report.issues.filter((issue) => issue.severity === "warning").map(publicIssue);

  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    license: manifest.license,
    platform: manifest.runtime.platform,
    minimum_platform_version: manifest.runtime.minimum_version,
    categories: [...(manifest.categories ?? [])],
    tags: [...(manifest.tags ?? [])],
    inputs: manifest.inputs.map((input) => ({
      name: input.name,
      type: input.type,
      required: input.required,
      description: input.description,
    })),
    outputs: manifest.outputs.map((output) => ({
      name: output.name,
      type: output.type,
      description: output.description,
    })),
    permissions: {
      network_access: manifest.permissions.network_access,
      filesystem_read: manifest.permissions.filesystem_read,
      filesystem_write: manifest.permissions.filesystem_write,
      email_send: manifest.permissions.email_send,
      social_publish: manifest.permissions.social_publish,
      code_execution: manifest.permissions.code_execution,
      credential_access: manifest.permissions.credential_access,
    },
    human_review: {
      required: manifest.human_review.required,
      checkpoints: [...manifest.human_review.checkpoints],
    },
    safety: {
      stores_user_data: manifest.safety.stores_user_data,
      sends_data_externally: manifest.safety.sends_data_externally,
      contains_credentials: manifest.safety.contains_credentials,
      risk_level: manifest.safety.risk_level,
    },
    testing: manifest.testing
      ? {
          status: manifest.testing.status,
          ...(manifest.testing.last_tested ? { last_tested: manifest.testing.last_tested } : {}),
          ...(manifest.testing.tested_platform_version
            ? { tested_platform_version: manifest.testing.tested_platform_version }
            : {}),
        }
      : null,
    package_path: packagePath,
    source_file: `${packagePath}/${manifest.runtime.source_file}`,
    readme_file: `${packagePath}/${manifest.files.readme}`,
    validation: {
      status: "valid",
      errors,
      warnings,
      checked_at: checkedAt,
    },
  };
}
