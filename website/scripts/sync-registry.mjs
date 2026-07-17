import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const websiteDirectory = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = fileURLToPath(new URL("../../registry/registry.json", import.meta.url));
const generatedDirectory = fileURLToPath(new URL("../generated/", import.meta.url));
const destinationPath = fileURLToPath(new URL("../generated/registry.json", import.meta.url));

function assertBasicRegistryStructure(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The root Registry must be a JSON object.");
  }

  if (typeof value.schema_version !== "string" || value.schema_version.length === 0) {
    throw new Error("The root Registry must contain a non-empty schema_version.");
  }

  if (!Array.isArray(value.workflows)) {
    throw new Error("The root Registry workflows field must be an array.");
  }

  if (!Number.isInteger(value.workflow_count)) {
    throw new Error("The root Registry workflow_count must be an integer.");
  }

  if (value.workflow_count !== value.workflows.length) {
    throw new Error(
      `The root Registry workflow_count (${value.workflow_count}) does not match workflows.length (${value.workflows.length}).`,
    );
  }
}

try {
  const sourceText = await readFile(sourcePath, "utf8");
  const registry = JSON.parse(sourceText);

  assertBasicRegistryStructure(registry);
  await mkdir(generatedDirectory, { recursive: true });
  await writeFile(destinationPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

  console.log(
    `Synced ${registry.workflow_count} workflows from registry/registry.json to ${destinationPath.slice(websiteDirectory.length)}.`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Registry sync failed: ${message}`);
  process.exitCode = 1;
}
