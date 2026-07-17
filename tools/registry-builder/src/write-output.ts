import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RegistryDocument, RejectedDocument } from "./types.js";

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

export async function writeOutput(
  repositoryRoot: string,
  registry: RegistryDocument,
  rejected: RejectedDocument,
): Promise<void> {
  const outputDirectory = path.join(repositoryRoot, "registry");
  await mkdir(outputDirectory, { recursive: true });
  await writeJsonAtomically(path.join(outputDirectory, "registry.json"), registry);
  await writeJsonAtomically(path.join(outputDirectory, "rejected.json"), rejected);
}
