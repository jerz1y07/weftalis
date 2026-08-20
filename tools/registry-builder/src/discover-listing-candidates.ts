import { readdir } from "node:fs/promises";
import path from "node:path";

import type { ListingDiscoveryResult } from "./types.js";

export async function discoverListingCandidates(
  admissionsRoot: string,
): Promise<ListingDiscoveryResult> {
  let entries;
  try {
    entries = await readdir(admissionsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { candidates: [], ignoredFiles: 0 };
    }
    throw error;
  }

  const candidates: ListingDiscoveryResult["candidates"] = [];
  let ignoredFiles = 0;

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (!entry.isFile() || entry.name.startsWith(".") || !entry.name.endsWith(".json")) {
      ignoredFiles += 1;
      continue;
    }

    candidates.push({
      name: entry.name.slice(0, -".json".length),
      recordPath: path.join(admissionsRoot, entry.name),
    });
  }

  return { candidates, ignoredFiles };
}
