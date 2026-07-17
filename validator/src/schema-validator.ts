import { readFile } from "node:fs/promises";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { ValidatorExecutionError } from "./result.js";
import type { ValidationIssue } from "./types.js";

function friendlySchemaMessage(error: ErrorObject): string {
  const location = error.instancePath || "workflow.yaml";

  if (error.keyword === "required") {
    const missing = String(error.params.missingProperty);
    return `${location} is missing required field "${missing}".`;
  }

  if (error.keyword === "additionalProperties") {
    const property = String(error.params.additionalProperty);
    return `${location} contains unknown field "${property}".`;
  }

  if (
    error.keyword === "pattern" &&
    (location === "/runtime/source_file" || location.startsWith("/files/"))
  ) {
    return `${location} must be a safe path relative to the Workflow Package. Do not use absolute paths, Windows drive paths, backslashes, or "..".`;
  }

  return `${location} ${error.message ?? "does not match the Specification"}.`;
}

export async function validateSchema(
  value: unknown,
  schemaPath: string,
): Promise<ValidationIssue[]> {
  let schema: object;

  try {
    schema = JSON.parse(await readFile(schemaPath, "utf8")) as object;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ValidatorExecutionError(
      `Could not load spec/workflow.schema.json: ${detail}`,
    );
  }

  try {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      // The v0.1 Schema defines the checkpoints array type in its parent
      // schema, then applies minItems/maxItems in conditional subschemas.
      // That is valid Draft 2020-12, but AJV's strictTypes lint expects the
      // type to be repeated locally. Only this lint is disabled; Schema and
      // format validation remain enabled.
      strictTypes: false,
    });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    if (validate(value)) {
      return [];
    }

    return (validate.errors ?? []).map((error) => ({
      severity: "error",
      code: `schema.${error.keyword}`,
      message: friendlySchemaMessage(error),
      file: "workflow.yaml",
    }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ValidatorExecutionError(
      `The Workflow Package Schema could not be compiled: ${detail}`,
    );
  }
}
