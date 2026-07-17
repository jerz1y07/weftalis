#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";

import { buildRegistry } from "./build-registry.js";
import type { ValidatePackage } from "./types.js";
import { writeOutput } from "./write-output.js";

export interface CliDependencies {
  repositoryRoot?: string;
  loadValidator?: () => Promise<ValidatePackage>;
  write?: typeof writeOutput;
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

export async function runCli(dependencies: CliDependencies = {}): Promise<number> {
  const log = dependencies.log ?? console.log;
  const error = dependencies.error ?? console.error;
  let validatePackage: ValidatePackage;
  let repositoryRoot: string;

  try {
    repositoryRoot = dependencies.repositoryRoot ?? defaultRepositoryRoot();
    await verifyRepositoryRoot(repositoryRoot);
    validatePackage = await (dependencies.loadValidator ?? defaultLoadValidator)();
  } catch {
    error("Registry Build\n\nRegistry Builder could not start or load the Validator.\nNo Workflow was executed.");
    return 2;
  }

  try {
    const result = await buildRegistry({ repositoryRoot, validatePackage });
    await (dependencies.write ?? writeOutput)(repositoryRoot, result.registry, result.rejected);

    const lines = [
      "Registry Build",
      "",
      `Discovered packages: ${result.discoveredCount}`,
      `Ignored templates: ${result.ignoredTemplates}`,
      `Valid packages: ${result.registry.workflow_count}`,
      `Rejected packages: ${result.rejected.rejected_count}`,
      "",
      ...result.registry.workflows.map((workflow) => `✓ ${workflow.id}`),
      ...result.rejected.packages.map((item) => `✗ ${item.id ?? item.package_path}`),
      "",
      "Wrote:",
      "- registry/registry.json",
      "- registry/rejected.json",
      "",
      "Result: SUCCESS",
    ];
    log(lines.join("\n"));
    return 0;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message.split("\n")[0] : "Unknown build error";
    error(`Registry Build\n\nRegistry generation failed: ${message}\nNo Workflow was executed.`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli();
}
