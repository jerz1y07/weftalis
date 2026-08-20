import {
  lstat,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { DiscoveryRunResult } from "./types.js";

export type DiscoveryOutputFormat = "json" | "jsonl";

export class DiscoveryOutputError extends Error {}

export interface DiscoveryWorkspaceResult {
  outputDirectory: string;
  candidateFile: string;
  reportFile: string;
  intakeManifestFile: string;
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

async function assertNoSymlinkComponents(root: string, candidate: string): Promise<void> {
  const relative = path.relative(root, candidate);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new DiscoveryOutputError("Discovery output path contains a symbolic-link component.");
      }
    } catch (caught) {
      if (caught instanceof DiscoveryOutputError) throw caught;
      if ((caught as NodeJS.ErrnoException).code === "ENOENT") return;
      throw new DiscoveryOutputError("Discovery output path could not be inspected safely.");
    }
  }
}

export function assertDiscoveryOutputPath(repositoryRoot: string, outputDirectory: string): void {
  const root = path.resolve(repositoryRoot);
  const output = path.resolve(outputDirectory);
  if (!inside(root, output) || output === root) {
    throw new DiscoveryOutputError("Discovery output must stay inside the repository's discovery-workspace directory.");
  }
  const relative = path.relative(root, output).split(path.sep);
  if (relative[0] !== "discovery-workspace" || relative.length < 2) {
    throw new DiscoveryOutputError("Discovery output must use discovery-workspace/<run-name>.");
  }
}

export function serializeCandidates(
  result: DiscoveryRunResult,
  format: DiscoveryOutputFormat,
): string {
  if (format === "jsonl") {
    return result.candidates.map((candidate) => JSON.stringify(candidate)).join("\n")
      + (result.candidates.length > 0 ? "\n" : "");
  }
  return `${JSON.stringify({ record_version: "1.0", candidates: result.candidates }, null, 2)}\n`;
}

export async function writeDiscoveryWorkspace(options: {
  repositoryRoot: string;
  outputDirectory: string;
  format: DiscoveryOutputFormat;
  result: DiscoveryRunResult;
}): Promise<DiscoveryWorkspaceResult> {
  const root = path.resolve(options.repositoryRoot);
  const output = path.resolve(options.outputDirectory);
  assertDiscoveryOutputPath(root, output);
  await assertNoSymlinkComponents(root, path.dirname(output));
  await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  await assertNoSymlinkComponents(root, path.dirname(output));
  try {
    await lstat(output);
    throw new DiscoveryOutputError("Discovery output directory already exists; choose a new run name.");
  } catch (caught) {
    if (caught instanceof DiscoveryOutputError) throw caught;
    if ((caught as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new DiscoveryOutputError("Discovery output destination could not be inspected safely.");
    }
  }

  const candidateName = options.format === "jsonl" ? "candidates.jsonl" : "candidates.json";
  const staging = await mkdtemp(path.join(path.dirname(output), `.${path.basename(output)}.staging-`));
  try {
    await writeFile(
      path.join(staging, candidateName),
      serializeCandidates(options.result, options.format),
      { encoding: "utf8", mode: 0o600 },
    );
    await writeFile(
      path.join(staging, "report.json"),
      `${JSON.stringify(options.result.report, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await writeFile(
      path.join(staging, "intake-manifest.json"),
      `${JSON.stringify(options.result.intake_manifest, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await rename(staging, output);
  } catch (caught) {
    await rm(staging, { recursive: true, force: true });
    if (caught instanceof DiscoveryOutputError) throw caught;
    throw new DiscoveryOutputError("Discovery evidence could not be written atomically.");
  }
  return {
    outputDirectory: output,
    candidateFile: path.join(output, candidateName),
    reportFile: path.join(output, "report.json"),
    intakeManifestFile: path.join(output, "intake-manifest.json"),
  };
}
