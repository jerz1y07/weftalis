import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";

import { discoverPackages } from "./discover-packages.js";
import { normalizeEntry, publicIssue, toPosixRelative } from "./normalize-entry.js";
import type {
  BuildResult,
  DiscoveredPackage,
  PublicIssue,
  ValidatePackage,
  ValidationIssue,
  ValidationReport,
  WorkflowManifest,
} from "./types.js";

interface BuildRegistryOptions {
  repositoryRoot: string;
  validatePackage: ValidatePackage;
  generatedAt?: string;
}

interface CandidateResult {
  candidate: DiscoveredPackage;
  report: ValidationReport;
  manifest: WorkflowManifest | null;
  readableId: string | null;
  builderIssues: ValidationIssue[];
}

function safeId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9-]{1,128}$/.test(value) ? value : null;
}

function syntheticReport(candidate: DiscoveredPackage, issue: ValidationIssue): ValidationReport {
  return {
    packageRoot: candidate.packageRoot,
    manifestPath: candidate.manifestPath,
    valid: false,
    checks: [],
    issues: [issue],
    errorCount: 1,
    warningCount: 0,
  };
}

async function inspectCandidate(
  candidate: DiscoveredPackage,
  validatePackage: ValidatePackage,
): Promise<CandidateResult> {
  let parsed: unknown;
  try {
    parsed = parse(await readFile(candidate.manifestPath, "utf8"));
  } catch {
    parsed = null;
  }
  const readableId = safeId(
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).id : null,
  );

  let report: ValidationReport;
  try {
    report = await validatePackage(candidate.packageRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Validator could not inspect this Package.";
    report = syntheticReport(candidate, {
      severity: "error",
      code: "validator.execution-failed",
      message,
      file: "workflow.yaml",
    });
  }

  return {
    candidate,
    report,
    manifest: report.valid ? (parsed as WorkflowManifest) : null,
    readableId,
    builderIssues: [],
  };
}

function addIdentityIssues(results: CandidateResult[], repositoryRoot: string): void {
  for (const result of results) {
    if (result.readableId && result.readableId !== result.candidate.name) {
      result.builderIssues.push({
        severity: "error",
        code: "registry.id-folder-mismatch",
        message: `Package id "${result.readableId}" must exactly match folder name "${result.candidate.name}".`,
        file: "workflow.yaml",
      });
    }
  }

  const groups = new Map<string, CandidateResult[]>();
  for (const result of results) {
    if (!result.readableId) continue;
    const key = result.readableId.toLocaleLowerCase("en-US");
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const locations = group
      .map((result) => toPosixRelative(repositoryRoot, result.candidate.packageRoot))
      .sort((left, right) => left.localeCompare(right, "en"));
    const ids = new Set(group.map((result) => result.readableId));
    const code = ids.size === 1 ? "registry.duplicate-id" : "registry.case-conflicting-id";
    const label = ids.size === 1 ? "Duplicate id" : "Case-insensitive id conflict";
    for (const result of group) {
      result.builderIssues.push({
        severity: "error",
        code,
        message: `${label} "${result.readableId}" found in: ${locations.join(", ")}.`,
        file: "workflow.yaml",
      });
    }
  }
}

function splitIssues(report: ValidationReport, builderIssues: ValidationIssue[]): {
  errors: PublicIssue[];
  warnings: PublicIssue[];
} {
  const issues = [...report.issues, ...builderIssues];
  return {
    errors: issues.filter((issue) => issue.severity === "error").map(publicIssue),
    warnings: issues.filter((issue) => issue.severity === "warning").map(publicIssue),
  };
}

export async function buildRegistry(options: BuildRegistryOptions): Promise<BuildResult> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const packagesRoot = path.join(options.repositoryRoot, "packages");
  const discovery = await discoverPackages(packagesRoot);
  const results = await Promise.all(
    discovery.packages.map((candidate) => inspectCandidate(candidate, options.validatePackage)),
  );
  addIdentityIssues(results, options.repositoryRoot);

  const workflows = [];
  const rejected = [];

  for (const result of results) {
    const hasBuilderError = result.builderIssues.some((issue) => issue.severity === "error");
    if (result.report.valid && result.manifest && !hasBuilderError) {
      workflows.push(
        normalizeEntry(
          result.manifest,
          result.report,
          options.repositoryRoot,
          result.candidate.packageRoot,
          generatedAt,
        ),
      );
      continue;
    }

    const issues = splitIssues(result.report, result.builderIssues);
    rejected.push({
      package_path: toPosixRelative(options.repositoryRoot, result.candidate.packageRoot),
      manifest_path: toPosixRelative(options.repositoryRoot, result.candidate.manifestPath),
      id: result.readableId,
      errors: issues.errors,
      warnings: issues.warnings,
    });
  }

  workflows.sort((left, right) => left.id.localeCompare(right.id, "en"));
  rejected.sort((left, right) => left.package_path.localeCompare(right.package_path, "en"));

  return {
    registry: {
      schema_version: "0.1",
      generated_at: generatedAt,
      workflow_count: workflows.length,
      workflows,
    },
    rejected: {
      schema_version: "0.1",
      generated_at: generatedAt,
      rejected_count: rejected.length,
      packages: rejected,
    },
    discoveredCount: discovery.packages.length,
    ignoredTemplates: discovery.ignoredTemplates,
    ignoredDirectories: discovery.ignoredDirectories,
  };
}
