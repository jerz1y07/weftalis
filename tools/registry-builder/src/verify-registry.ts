import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { buildRegistry } from "./build-registry.js";
import type { ValidatePackage } from "./types.js";
import { writeOutput } from "./write-output.js";

export interface VerifyRegistryOptions {
  repositoryRoot: string;
  validatePackage: ValidatePackage;
  generatedAt?: string;
  temporaryParent?: string;
}

export interface VerifyRegistryResult {
  matches: boolean;
  differences: string[];
}

interface RegistryDocuments {
  registry: unknown;
  rejected: unknown;
}

const maximumReportedDifferences = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function normalizeRegistryDocument(value: unknown): unknown {
  const normalized = cloneJson(value);
  if (!isRecord(normalized)) return normalized;

  delete normalized.generated_at;
  if (!Array.isArray(normalized.workflows)) return normalized;

  for (const workflow of normalized.workflows) {
    if (!isRecord(workflow) || !isRecord(workflow.validation)) continue;
    delete workflow.validation.checked_at;
  }
  return normalized;
}

function normalizeRejectedDocument(value: unknown): unknown {
  const normalized = cloneJson(value);
  if (isRecord(normalized)) delete normalized.generated_at;
  return normalized;
}

function valueKind(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function childPath(parent: string, key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}["unexpected-key"]`;
}

function collectDifferences(
  generated: unknown,
  committed: unknown,
  currentPath: string,
  differences: string[],
): void {
  if (differences.length >= maximumReportedDifferences || Object.is(generated, committed)) return;

  if (Array.isArray(generated) && Array.isArray(committed)) {
    if (generated.length !== committed.length) {
      differences.push(`${currentPath}.length (array length changed)`);
    }
    const sharedLength = Math.min(generated.length, committed.length);
    for (let index = 0; index < sharedLength; index += 1) {
      collectDifferences(generated[index], committed[index], `${currentPath}[${index}]`, differences);
    }
    return;
  }

  if (isRecord(generated) && isRecord(committed)) {
    const keys = [...new Set([...Object.keys(generated), ...Object.keys(committed)])]
      .sort((left, right) => left.localeCompare(right, "en"));
    for (const key of keys) {
      const nextPath = childPath(currentPath, key);
      if (!(key in generated)) {
        differences.push(`${nextPath} (present only in committed data)`);
      } else if (!(key in committed)) {
        differences.push(`${nextPath} (missing from committed data)`);
      } else {
        collectDifferences(generated[key], committed[key], nextPath, differences);
      }
      if (differences.length >= maximumReportedDifferences) return;
    }
    return;
  }

  if (valueKind(generated) !== valueKind(committed)) {
    differences.push(`${currentPath} (value type changed)`);
  } else {
    differences.push(`${currentPath} (value changed)`);
  }
}

function compareDocument(
  fileName: string,
  generated: unknown,
  committed: unknown,
  normalize: (value: unknown) => unknown,
): string[] {
  const differences: string[] = [];
  collectDifferences(normalize(generated), normalize(committed), "$", differences);
  return differences.map((difference) => `${fileName}: ${difference}`);
}

export function compareRegistryDocuments(
  generated: RegistryDocuments,
  committed: RegistryDocuments,
): string[] {
  return [
    ...compareDocument(
      "registry/registry.json",
      generated.registry,
      committed.registry,
      normalizeRegistryDocument,
    ),
    ...compareDocument(
      "registry/rejected.json",
      generated.rejected,
      committed.rejected,
      normalizeRejectedDocument,
    ),
  ].slice(0, maximumReportedDifferences);
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function readDocuments(root: string): Promise<RegistryDocuments> {
  return {
    registry: await readJson(path.join(root, "registry", "registry.json")),
    rejected: await readJson(path.join(root, "registry", "rejected.json")),
  };
}

export async function verifyRegistry(options: VerifyRegistryOptions): Promise<VerifyRegistryResult> {
  const temporaryParent = options.temporaryParent
    ?? path.join(options.repositoryRoot, "tools", "registry-builder");
  const temporaryRoot = await mkdtemp(path.join(temporaryParent, ".verify-registry-"));

  try {
    const result = await buildRegistry({
      repositoryRoot: options.repositoryRoot,
      validatePackage: options.validatePackage,
      generatedAt: options.generatedAt,
    });
    await writeOutput(temporaryRoot, result.registry, result.rejected);

    const [generated, committed] = await Promise.all([
      readDocuments(temporaryRoot),
      readDocuments(options.repositoryRoot),
    ]);
    const differences = compareRegistryDocuments(generated, committed);
    return { matches: differences.length === 0, differences };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
