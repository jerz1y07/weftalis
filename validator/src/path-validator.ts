import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type {
  FileReference,
  ValidatedFile,
  ValidationIssue,
} from "./types.js";

export interface PathValidationResult {
  files: ValidatedFile[];
  issues: ValidationIssue[];
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function decodePath(value: string): string | undefined {
  let decoded = value;

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        return decoded;
      }
      decoded = next;
    }
    return decoded;
  } catch {
    return undefined;
  }
}

function lexicalPathError(reference: FileReference): string | undefined {
  const decoded = decodePath(reference.path);

  if (decoded === undefined) {
    return `${reference.field} uses invalid URL encoding in path ${reference.path}.`;
  }

  if (decoded.includes("\0")) {
    return `${reference.field} contains a null byte and is not a safe path.`;
  }

  if (decoded.includes("\\")) {
    return `${reference.field} must use forward slashes, not backslashes: ${reference.path}.`;
  }

  if (decoded.startsWith("/") || /^[A-Za-z]:/.test(decoded)) {
    return `${reference.field} must be relative to the Workflow Package: ${reference.path}.`;
  }

  const segments = decoded.split("/");
  if (segments.includes("..")) {
    return `${reference.field} must not leave the Workflow Package with "..": ${reference.path}.`;
  }

  return undefined;
}

export async function validateFileReferences(
  packageRoot: string,
  references: FileReference[],
): Promise<PathValidationResult> {
  const issues: ValidationIssue[] = [];
  const files: ValidatedFile[] = [];
  const realPackageRoot = await realpath(packageRoot);

  for (const reference of references) {
    const lexicalError = lexicalPathError(reference);
    if (lexicalError) {
      issues.push({
        severity: "error",
        code: "path.unsafe",
        message: lexicalError,
        file: "workflow.yaml",
      });
      continue;
    }

    const decodedPath = decodePath(reference.path);
    if (decodedPath === undefined) {
      continue;
    }

    const absolutePath = path.resolve(realPackageRoot, decodedPath);
    if (!isInside(realPackageRoot, absolutePath)) {
      issues.push({
        severity: "error",
        code: "path.outside-package",
        message: `${reference.field} points outside the Workflow Package: ${reference.path}.`,
        file: "workflow.yaml",
      });
      continue;
    }

    try {
      await lstat(absolutePath);
    } catch {
      issues.push({
        severity: "error",
        code: "path.missing-file",
        message: `${reference.field} references ${reference.path}, but the file does not exist.`,
        file: "workflow.yaml",
      });
      continue;
    }

    let resolvedPath: string;
    try {
      resolvedPath = await realpath(absolutePath);
    } catch {
      issues.push({
        severity: "error",
        code: "path.unreadable-file",
        message: `${reference.field} references ${reference.path}, but the file cannot be resolved.`,
        file: "workflow.yaml",
      });
      continue;
    }

    if (!isInside(realPackageRoot, resolvedPath)) {
      issues.push({
        severity: "error",
        code: "path.symlink-outside-package",
        message: `${reference.field} resolves outside the Workflow Package: ${reference.path}.`,
        file: "workflow.yaml",
      });
      continue;
    }

    const fileStats = await stat(resolvedPath);
    if (!fileStats.isFile()) {
      issues.push({
        severity: "error",
        code: "path.not-file",
        message: `${reference.field} references ${reference.path}, but it is not a regular file.`,
        file: "workflow.yaml",
      });
      continue;
    }

    files.push({ ...reference, absolutePath: resolvedPath });
  }

  return { files, issues };
}
