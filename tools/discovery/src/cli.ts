#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runDiscovery, DiscoveryConfigurationError } from "./discovery.js";
import {
  githubTokenFromEnvironment,
  GitHubClient,
  GitHubRepositoryTreeAdapter,
  type FetchLike,
} from "./github.js";
import {
  DiscoveryOutputError,
  serializeCandidates,
  writeDiscoveryWorkspace,
  type DiscoveryOutputFormat,
} from "./output.js";
import { DEFAULT_DISCOVERY_SOURCES } from "./sources.js";
import type { DiscoveryPlatform, DiscoverySource } from "./types.js";

interface CliArguments {
  limit: number;
  platforms: DiscoveryPlatform[];
  sourceIds: string[];
  format: DiscoveryOutputFormat;
  discoveredAt?: string;
  dryRun: boolean;
  write: boolean;
  outputDirectory?: string;
  listSources: boolean;
  help: boolean;
}

export interface DiscoveryCliDependencies {
  repositoryRoot?: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
  sources?: DiscoverySource[];
  fetchImpl?: FetchLike;
  now?: () => Date;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

const usage = [
  "Weft Place External Discovery",
  "",
  "Usage:",
  "  npm run discover -- --limit 75 --dry-run",
  "  npm run discover -- --platform n8n --source github:n8n-official-starter-kit --format jsonl --dry-run",
  "  npm run discover -- --limit 75 --format jsonl --write --output-dir ../../discovery-workspace/smoke-run",
  "  npm run discover -- --list-sources",
  "",
  "Preview is the default. --write is required to create ignored local evidence.",
  "Authentication is optional through GITHUB_TOKEN or GH_TOKEN; tokens are never printed or stored.",
  "Discovery never executes a Workflow and never writes Packages, admissions, Registry, or website data.",
].join("\n");

function takeValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new DiscoveryConfigurationError(`${option} requires a value.`);
  }
  return value;
}

export function parseArguments(args: string[]): CliArguments {
  let limit = 75;
  const platforms: DiscoveryPlatform[] = [];
  const sourceIds: string[] = [];
  let format: DiscoveryOutputFormat = "json";
  let discoveredAt: string | undefined;
  let dryRun = false;
  let write = false;
  let outputDirectory: string | undefined;
  let listSources = false;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--limit") {
      const value = takeValue(args, index, argument);
      limit = Number(value);
      index += 1;
    } else if (argument === "--platform") {
      const value = takeValue(args, index, argument);
      if (value !== "dify" && value !== "n8n" && value !== "unknown") {
        throw new DiscoveryConfigurationError("--platform must be dify, n8n, or unknown.");
      }
      platforms.push(value);
      index += 1;
    } else if (argument === "--source") {
      sourceIds.push(takeValue(args, index, argument));
      index += 1;
    } else if (argument === "--format") {
      const value = takeValue(args, index, argument);
      if (value !== "json" && value !== "jsonl") {
        throw new DiscoveryConfigurationError("--format must be json or jsonl.");
      }
      format = value;
      index += 1;
    } else if (argument === "--discovered-at") {
      discoveredAt = takeValue(args, index, argument);
      index += 1;
    } else if (argument === "--output-dir") {
      outputDirectory = takeValue(args, index, argument);
      index += 1;
    } else if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--write") {
      write = true;
    } else if (argument === "--list-sources") {
      listSources = true;
    } else if (argument === "--help" || argument === "-h") {
      help = true;
    } else {
      throw new DiscoveryConfigurationError(`Unsupported Discovery option: ${argument}.`);
    }
  }
  if (write && dryRun) throw new DiscoveryConfigurationError("Choose either --write or --dry-run, not both.");
  if (write && !outputDirectory) throw new DiscoveryConfigurationError("--write requires --output-dir.");
  if (!write && outputDirectory) throw new DiscoveryConfigurationError("--output-dir is used only with explicit --write.");
  return {
    limit,
    platforms: [...new Set(platforms)].sort(),
    sourceIds: [...new Set(sourceIds)].sort(),
    format,
    discoveredAt,
    dryRun,
    write,
    outputDirectory,
    listSources,
    help,
  };
}

function defaultRepositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function sourceDate(environment: NodeJS.ProcessEnv, now: () => Date): string {
  const epoch = environment.SOURCE_DATE_EPOCH;
  if (epoch && /^\d+$/.test(epoch)) {
    const date = new Date(Number(epoch) * 1_000);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return now().toISOString();
}

function sourceListing(sources: DiscoverySource[]): string {
  return sources
    .slice()
    .sort((left, right) => left.source_id.localeCompare(right.source_id, "en"))
    .map((source) => `${source.source_id}\t${source.platform}\t${source.label}`)
    .join("\n");
}

function humanSummary(result: Awaited<ReturnType<typeof runDiscovery>>, outputDirectory: string): string {
  return [
    "Weft Place External Discovery",
    "",
    `Raw candidates: ${result.report.raw_candidate_count}`,
    `Unique candidates: ${result.report.unique_candidate_count}`,
    `Duplicates: ${result.report.duplicate_count}`,
    `Platforms: ${JSON.stringify(result.report.platform_distribution)}`,
    `Sources: ${JSON.stringify(result.report.source_distribution)}`,
    `Immutable versions resolved: ${result.report.immutable_version_resolved_count}`,
    `Identifiable repository license evidence: ${result.report.identifiable_license_evidence_count}`,
    `Intake-ready: ${result.report.intake_ready_count}`,
    `Skipped: ${result.report.skipped_count}`,
    `Output: ${outputDirectory}`,
    "",
    "No candidate was Listed, executed, runtime tested, or compatibility verified.",
  ].join("\n");
}

export async function runCli(
  args: string[] = process.argv.slice(2),
  dependencies: DiscoveryCliDependencies = {},
): Promise<number> {
  const log = dependencies.log ?? console.log;
  const error = dependencies.error ?? console.error;
  const environment = dependencies.environment ?? process.env;
  const sources = dependencies.sources ?? DEFAULT_DISCOVERY_SOURCES;
  let parsed: CliArguments;
  try {
    parsed = parseArguments(args);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Invalid Discovery arguments.";
    error(`${usage}\n\nInput error: ${message}`);
    return 2;
  }
  if (parsed.help) {
    log(usage);
    return 0;
  }
  if (parsed.listSources) {
    log(sourceListing(sources));
    return 0;
  }

  const token = githubTokenFromEnvironment(environment);
  try {
    const result = await runDiscovery({
      limit: parsed.limit,
      platforms: parsed.platforms,
      sourceIds: parsed.sourceIds,
      discoveredAt: parsed.discoveredAt ?? sourceDate(environment, dependencies.now ?? (() => new Date())),
      githubAuthenticated: Boolean(token),
    }, sources, [
      new GitHubRepositoryTreeAdapter(new GitHubClient({
        token,
        fetchImpl: dependencies.fetchImpl,
      })),
    ]);

    if (parsed.write) {
      if (result.report.source_errors.length > 0) {
        error(`${JSON.stringify(result.report, null, 2)}\nDiscovery output was not written because one or more sources failed.`);
        return 1;
      }
      const repositoryRoot = dependencies.repositoryRoot ?? defaultRepositoryRoot();
      const cwd = dependencies.cwd ?? process.cwd();
      const workspace = await writeDiscoveryWorkspace({
        repositoryRoot,
        outputDirectory: path.resolve(cwd, parsed.outputDirectory!),
        format: parsed.format,
        result,
      });
      log(humanSummary(result, workspace.outputDirectory));
    } else if (parsed.format === "jsonl") {
      log(serializeCandidates(result, "jsonl").trimEnd());
      error(JSON.stringify(result.report));
    } else {
      log(JSON.stringify(result, null, 2));
    }
    return result.report.source_errors.length > 0 ? 1 : 0;
  } catch (caught) {
    if (caught instanceof DiscoveryConfigurationError || caught instanceof DiscoveryOutputError) {
      error(`Weft Place External Discovery\n\nDiscovery stopped: ${caught.message}\nNo Workflow was executed or published.`);
      return 2;
    }
    error("Weft Place External Discovery\n\nDiscovery stopped because of an internal error.\nNo Workflow was executed or published.");
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli();
}
