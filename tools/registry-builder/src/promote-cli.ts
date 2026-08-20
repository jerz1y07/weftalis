#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  promoteIntake,
  PromotionError,
  PromotionWriteError,
  type PromoteIntakeResult,
} from "./promote-intake.js";

export interface PromoteCliDependencies {
  repositoryRoot?: string;
  cwd?: string;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

interface ParsedArguments {
  inputPath: string;
  outputPath: string;
  write: boolean;
}

const usage = [
  "Weft Place Admission Promotion",
  "",
  "Usage:",
  "  npm run admission:promote -- <promotion-request.json> --output <id.json> [--dry-run | --write]",
  "",
  "The default is preview-only. Use --write for an explicit admission-record write.",
  "No Workflow is executed and Registry, Packages, website, and Intake data are not modified.",
].join("\n");

function parseArguments(args: string[], cwd: string): ParsedArguments {
  const positionals: string[] = [];
  let output: string | null = null;
  let write = false;
  let explicitDryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--output") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new PromotionError("--output requires a path.");
      output = value;
      index += 1;
    } else if (argument === "--write") {
      write = true;
    } else if (argument === "--dry-run") {
      explicitDryRun = true;
    } else if (argument === "--help" || argument === "-h") {
      throw new PromotionError(usage);
    } else if (argument.startsWith("--")) {
      throw new PromotionError("Unknown promotion option.");
    } else {
      positionals.push(argument);
    }
  }
  if (write && explicitDryRun) throw new PromotionError("Choose either --write or --dry-run, not both.");
  if (positionals.length !== 1 || output === null) throw new PromotionError("One input path and --output are required.");
  return {
    inputPath: path.resolve(cwd, positionals[0]!),
    outputPath: path.resolve(cwd, output),
    write,
  };
}

function defaultRepositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function stateLabel(state: PromoteIntakeResult["decision"]["state"]): string {
  if (state === "needs_review") return "Needs Review";
  if (state === "quarantined") return "Quarantined";
  return "Listed";
}

function summary(result: PromoteIntakeResult, write: boolean): string {
  const sourceType = result.record.source.source_type;
  const signals = result.importantSignals.length > 0 ? result.importantSignals.join(", ") : "none";
  const missing = result.missingEvidence.length > 0 ? result.missingEvidence.join(", ") : "none";
  const action = !write
    ? "Preview only; no file was written."
    : result.reusedExisting
      ? "Identical record already exists; bytes were reused."
      : "Admission record written. Public Registry was not modified.";
  return [
    "Weft Place Admission Promotion",
    "",
    `Mode: ${write ? "WRITE" : "PREVIEW"}`,
    `Workflow identity: ${result.record.id}`,
    `Source type: ${sourceType}`,
    `Provenance completeness: ${result.record.evidence.provenance_status}`,
    `License evidence result: ${result.record.evidence.license_status}`,
    `Important risk/escalation signals: ${signals}`,
    `Proposed admission state: ${stateLabel(result.decision.state)}`,
    `Missing evidence: ${missing}`,
    `Record identity: ${result.record.evidence.intake_review_id}`,
    `Output path: ${result.outputPath}`,
    "",
    action,
    "No Workflow was executed.",
  ].join("\n");
}

export async function runPromoteCli(
  args: string[] = process.argv.slice(2),
  dependencies: PromoteCliDependencies = {},
): Promise<number> {
  const log = dependencies.log ?? console.log;
  const error = dependencies.error ?? console.error;
  const cwd = dependencies.cwd ?? process.cwd();
  let parsed: ParsedArguments;
  try {
    parsed = parseArguments(args, cwd);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Invalid promotion arguments.";
    error(message === usage ? message : `${usage}\n\nInput error: ${message}`);
    return 2;
  }

  try {
    const result = await promoteIntake({
      repositoryRoot: dependencies.repositoryRoot ?? defaultRepositoryRoot(),
      inputPath: parsed.inputPath,
      outputPath: parsed.outputPath,
      write: parsed.write,
    });
    log(summary(result, parsed.write));
    return 0;
  } catch (caught) {
    const message = caught instanceof PromotionError ? caught.message : "Promotion failed safely.";
    error(`Weft Place Admission Promotion\n\nPromotion stopped: ${message}\nNo Workflow was executed.`);
    return caught instanceof PromotionWriteError ? 1 : 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runPromoteCli();
}
