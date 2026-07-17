import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const registryPath = fileURLToPath(new URL("../generated/registry.json", import.meta.url));
const allowedValidationStatuses = new Set(["valid"]);
const requiredStringFields = ["id", "name", "description", "platform", "version"];

function requireObject(value, location) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${location} must be an object.`);
  }
  return value;
}

function checkRegistry(value) {
  const registry = requireObject(value, "Registry");

  if (typeof registry.schema_version !== "string" || registry.schema_version.length === 0) {
    throw new Error("Registry schema_version must be a non-empty string.");
  }
  if (!Array.isArray(registry.workflows)) {
    throw new Error("Registry workflows must be an array.");
  }
  if (!Number.isInteger(registry.workflow_count)) {
    throw new Error("Registry workflow_count must be an integer.");
  }
  if (registry.workflow_count !== registry.workflows.length) {
    throw new Error(
      `Registry workflow_count (${registry.workflow_count}) does not match workflows.length (${registry.workflows.length}).`,
    );
  }

  const ids = new Set();
  registry.workflows.forEach((candidate, index) => {
    const location = `workflows[${index}]`;
    const workflow = requireObject(candidate, location);

    for (const field of requiredStringFields) {
      if (typeof workflow[field] !== "string" || workflow[field].length === 0) {
        throw new Error(`${location}.${field} must be a non-empty string.`);
      }
    }

    if (ids.has(workflow.id)) {
      throw new Error(`Duplicate Workflow id: ${workflow.id}.`);
    }
    ids.add(workflow.id);

    const validation = requireObject(workflow.validation, `${location}.validation`);
    if (typeof validation.status !== "string" || !allowedValidationStatuses.has(validation.status)) {
      throw new Error(
        `${location}.validation.status must be one of: ${[...allowedValidationStatuses].join(", ")}.`,
      );
    }
  });

  return registry.workflows.length;
}

try {
  const registryText = await readFile(registryPath, "utf8");
  const workflowCount = checkRegistry(JSON.parse(registryText));
  console.log(`Registry check passed for ${workflowCount} unique workflows.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Registry check failed: ${message}`);
  process.exitCode = 1;
}
