import { readdir } from "node:fs/promises";
import path from "node:path";

import type { DiscoveryResult } from "./types.js";

const ignoredDirectoryNames = new Set(["node_modules", "tmp", "temp"]);

export async function discoverPackages(packagesRoot: string): Promise<DiscoveryResult> {
  const entries = await readdir(packagesRoot, { withFileTypes: true });
  const packages: DiscoveryResult["packages"] = [];
  let ignoredTemplates = 0;
  let ignoredDirectories = 0;

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith("_")) {
      ignoredTemplates += 1;
      continue;
    }

    if (entry.name.startsWith(".") || ignoredDirectoryNames.has(entry.name.toLowerCase())) {
      ignoredDirectories += 1;
      continue;
    }

    const packageRoot = path.join(packagesRoot, entry.name);
    const manifestPath = path.join(packageRoot, "workflow.yaml");
    const files = await readdir(packageRoot, { withFileTypes: true });
    if (!files.some((file) => file.isFile() && file.name === "workflow.yaml")) {
      ignoredDirectories += 1;
      continue;
    }

    packages.push({ name: entry.name, packageRoot, manifestPath });
  }

  return { packages, ignoredTemplates, ignoredDirectories };
}
