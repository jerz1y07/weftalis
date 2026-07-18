#!/usr/bin/env node

import path from "node:path";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { ValidatePackage } from "./types.js";
import { verifyRegistry, type VerifyRegistryResult } from "./verify-registry.js";

export interface VerifyCliDependencies {
  repositoryRoot?: string;
  loadValidator?: () => Promise<ValidatePackage>;
  verify?: (repositoryRoot: string, validatePackage: ValidatePackage) => Promise<VerifyRegistryResult>;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

async function defaultLoadValidator(): Promise<ValidatePackage> {
  const publicValidatorEntry = "../../../validator/src/index.js";
  const validator = await import(publicValidatorEntry) as { validatePackage: ValidatePackage };
  if (typeof validator.validatePackage !== "function") {
    throw new Error("Validator public entry does not export validatePackage.");
  }
  return validator.validatePackage;
}

function defaultRepositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

async function verifyRepositoryRoot(repositoryRoot: string): Promise<void> {
  const packagesStats = await stat(path.join(repositoryRoot, "packages"));
  if (!packagesStats.isDirectory()) {
    throw new Error("Repository packages directory is unavailable.");
  }
}

export async function runVerifyCli(dependencies: VerifyCliDependencies = {}): Promise<number> {
  const log = dependencies.log ?? console.log;
  const error = dependencies.error ?? console.error;
  let repositoryRoot: string;
  let validatePackage: ValidatePackage;

  try {
    repositoryRoot = dependencies.repositoryRoot ?? defaultRepositoryRoot();
    await verifyRepositoryRoot(repositoryRoot);
    validatePackage = await (dependencies.loadValidator ?? defaultLoadValidator)();
  } catch {
    error("Weftalis Registry Verification\n\nThe verifier could not start or load the Validator.\nNo Workflow was executed.");
    return 2;
  }

  try {
    const result = dependencies.verify
      ? await dependencies.verify(repositoryRoot, validatePackage)
      : await verifyRegistry({ repositoryRoot, validatePackage });

    if (!result.matches) {
      error([
        "Weftalis Registry Verification",
        "",
        "Committed Registry data is out of date:",
        ...result.differences.map((difference) => `✗ ${difference}`),
        "",
        "Fix: run npm run build-registry, review the generated files, then sync the website Registry.",
        "Only JSON paths are shown; field values are not printed.",
        "No Workflow was executed.",
      ].join("\n"));
      return 1;
    }

    log([
      "Weftalis Registry Verification",
      "",
      "✓ Committed Registry data matches a fresh build.",
      "✓ Timestamp-only differences were ignored.",
      "✓ Formal Registry files were not overwritten.",
      "",
      "Result: SUCCESS",
      "No Workflow was executed.",
    ].join("\n"));
    return 0;
  } catch {
    error([
      "Weftalis Registry Verification",
      "",
      "The verifier could not generate, read, or compare Registry data.",
      "Check that both committed Registry JSON files exist and contain valid JSON.",
      "No field values were printed. No Workflow was executed.",
    ].join("\n"));
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runVerifyCli();
}
