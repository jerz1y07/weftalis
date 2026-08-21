#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatSummary,
  OrchestrationError,
  runBatch,
  type BatchOptions,
} from "./orchestrator.js";

interface CliArguments {
  inputPath: string;
  write: boolean;
  resume: boolean;
  limit?: number;
  concurrency: number;
  runId?: string;
  json: boolean;
  registryPreview: boolean;
  help: boolean;
}

export interface CliDependencies {
  repositoryRoot?: string;
  run?: (options: BatchOptions) => ReturnType<typeof runBatch>;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

function usage(): string {
  return [
    "Weft Place Batch Ingestion",
    "",
    "Usage:",
    "  npm run ingestion:batch -- <discovery-run-or-manifest> [--dry-run] [--limit 25] [--concurrency 4]",
    "  npm run ingestion:batch -- <discovery-run-or-manifest> --write [--resume] [--run-id name]",
    "",
    "Preview is the default. --write is required for ingestion-workspace output.",
    "Individual candidate failures are recorded and do not make the CLI fail.",
    "The command never executes imported Workflows or publishes production Registry data.",
  ].join("\n");
}

function integer(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new OrchestrationError(`${name} requires an integer.`);
  return parsed;
}

function parseArguments(args: string[]): CliArguments {
  let inputPath = "";
  let write = false;
  let resume = false;
  let limit: number | undefined;
  let concurrency = 4;
  let runId: string | undefined;
  let json = false;
  let registryPreview = true;
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--write") write = true;
    else if (argument === "--dry-run") write = false;
    else if (argument === "--resume") resume = true;
    else if (argument === "--json") json = true;
    else if (argument === "--no-registry-preview") registryPreview = false;
    else if (argument === "--help" || argument === "-h") help = true;
    else if (argument === "--limit") limit = integer(args[++index], "--limit");
    else if (argument === "--concurrency") concurrency = integer(args[++index], "--concurrency");
    else if (argument === "--run-id") runId = args[++index] ?? "";
    else if (argument.startsWith("-")) throw new OrchestrationError(`Unsupported argument: ${argument}`);
    else if (inputPath) throw new OrchestrationError("Provide exactly one Discovery run or Intake manifest.");
    else inputPath = argument;
  }
  if (!help && !inputPath) throw new OrchestrationError("A Discovery run or Intake manifest is required.");
  if (resume && !write) throw new OrchestrationError("--resume requires --write.");
  return { inputPath, write, resume, limit, concurrency, runId, json, registryPreview, help };
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
    error(`${usage()}\n\nError: ${caught instanceof Error ? caught.message : "Invalid arguments."}`);
    return 2;
  }
  if (parsed.help) {
    log(usage());
    return 0;
  }
  try {
    const summary = await (dependencies.run ?? runBatch)({
      repositoryRoot: dependencies.repositoryRoot ?? defaultRepositoryRoot(),
      inputPath: path.resolve(parsed.inputPath),
      write: parsed.write,
      resume: parsed.resume,
      limit: parsed.limit,
      concurrency: parsed.concurrency,
      runId: parsed.runId,
      registryPreview: parsed.registryPreview,
    });
    log(parsed.json ? JSON.stringify(summary, null, 2) : formatSummary(summary));
    return 0;
  } catch (caught) {
    const message = caught instanceof OrchestrationError ? caught.message : "A systemic orchestration failure stopped the batch.";
    error(`Weft Place Batch Ingestion\n\n${message}\nNo imported Workflow was executed or published.`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli();
}
