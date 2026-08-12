#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runIntake, type IntakeRunOptions, type IntakeRunResult } from "./intake.js";
import { IntakeValidationError } from "./schema-validator.js";

interface CliArguments {
  manifestPath: string;
  outputRoot?: string;
  dryRun: boolean;
  help: boolean;
}

export interface CliDependencies {
  repositoryRoot?: string;
  run?: (options: IntakeRunOptions) => Promise<IntakeRunResult>;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

function usage(): string {
  return [
    "Weftalis Local Intake",
    "",
    "Usage:",
    "  npm run intake -- --manifest path/to/candidates.json --dry-run",
    "  npm run intake -- --manifest path/to/candidates.yaml --output path/to/intake-review",
    "",
    "The CLI retrieves and audits public GitHub artifacts as data. It never executes or publishes a Workflow.",
  ].join("\n");
}

function parseArguments(args: string[]): CliArguments {
  let manifestPath = "";
  let outputRoot: string | undefined;
  let dryRun = false;
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--manifest") {
      manifestPath = args[++index] ?? "";
    } else if (argument === "--output") {
      outputRoot = args[++index];
    } else {
      throw new IntakeValidationError(`Unsupported CLI argument: ${argument}`);
    }
  }
  if (!help && !manifestPath) {
    throw new IntakeValidationError("--manifest is required.");
  }
  return { manifestPath, outputRoot, dryRun, help };
}

function defaultRepositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

export async function runCli(
  args = process.argv.slice(2),
  dependencies: CliDependencies = {},
): Promise<number> {
  const log = dependencies.log ?? console.log;
  const error = dependencies.error ?? console.error;
  let parsed: CliArguments;
  try {
    parsed = parseArguments(args);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Invalid CLI arguments.";
    error(`${usage()}\n\nError: ${message}`);
    return 2;
  }
  if (parsed.help) {
    log(usage());
    return 0;
  }

  try {
    const repositoryRoot = dependencies.repositoryRoot ?? defaultRepositoryRoot();
    const result = await (dependencies.run ?? runIntake)({
      manifestPath: path.resolve(parsed.manifestPath),
      repositoryRoot,
      outputRoot: parsed.outputRoot ? path.resolve(parsed.outputRoot) : undefined,
      dryRun: parsed.dryRun,
    });
    const lines = [
      "Weftalis Local Intake",
      "",
      `Mode: ${result.dryRun ? "DRY RUN (no files written)" : "LOCAL REVIEW OUTPUT"}`,
      `Candidates processed: ${result.processed.length}`,
      `Retrieval failures: ${result.failedCount}`,
      "",
      ...result.processed.map(({ record, reusedExisting }) => (
        `${record.moderation.current_status === "quarantined" ? "⚠" : "✓"} ${record.review_id} — ${record.moderation.current_status}`
        + `${reusedExisting ? " (existing record verified)" : ""}`
      )),
      "",
      "No Workflow was executed. No Workflow Package or public Registry file was modified.",
      "Human review is required; intake records were not published.",
    ];
    log(lines.join("\n"));
    return result.failedCount > 0 ? 1 : 0;
  } catch (caught) {
    if (caught instanceof IntakeValidationError) {
      error([
        "Weftalis Local Intake",
        "",
        caught.message,
        ...caught.issues.slice(0, 20).map((issue) => `- ${issue}`),
        "",
        "No Workflow was executed or published.",
      ].join("\n"));
      return 2;
    }
    error("Weftalis Local Intake\n\nIntake stopped because of an internal error.\nNo Workflow was executed or published.");
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli();
}
