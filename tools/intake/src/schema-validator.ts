import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parseDocument } from "yaml";

import { scanForPotentialSecrets } from "./secret-scanner.js";
import type { SubmissionManifest } from "./types.js";

export const schemaIds = {
  submission: "urn:weftalis:intake:community-submission:1.0",
  manifest: "urn:weftalis:intake:submission-manifest:1.0",
  resolvedArtifact: "urn:weftalis:intake:resolved-upstream-artifact:1.0",
  staticAudit: "urn:weftalis:intake:static-audit-result:1.0",
  moderation: "urn:weftalis:intake:moderation-status:1.0",
  reviewRecord: "urn:weftalis:intake:review-record:1.0",
} as const;

export class IntakeValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "IntakeValidationError";
  }
}

function schemasDirectory(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../schemas");
}

function friendlyError(error: ErrorObject): string {
  const location = error.instancePath || "$";
  if (error.keyword === "required") {
    return `${location} is missing required field "${String(error.params.missingProperty)}".`;
  }
  if (error.keyword === "additionalProperties") {
    return `${location} contains unsupported field "${String(error.params.additionalProperty)}".`;
  }
  return `${location} ${error.message ?? "does not match the intake schema"}.`;
}

export async function createSchemaRegistry(): Promise<Ajv2020> {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const directory = schemasDirectory();
  const files = (await readdir(directory))
    .filter((name) => name.endsWith(".schema.json"))
    .sort((left, right) => left.localeCompare(right, "en"));

  for (const file of files) {
    const schema = JSON.parse(await readFile(path.join(directory, file), "utf8")) as object;
    ajv.addSchema(schema);
  }
  return ajv;
}

export async function validateAgainstSchema(
  schemaId: string,
  value: unknown,
): Promise<string[]> {
  const ajv = await createSchemaRegistry();
  const validate: ValidateFunction | undefined = ajv.getSchema(schemaId);
  if (!validate) {
    throw new IntakeValidationError(`Schema is unavailable: ${schemaId}`);
  }
  return validate(value) ? [] : (validate.errors ?? []).map(friendlyError);
}

export async function loadSubmissionManifest(manifestPath: string): Promise<SubmissionManifest> {
  const extension = path.extname(manifestPath).toLowerCase();
  if (![".json", ".yaml", ".yml"].includes(extension)) {
    throw new IntakeValidationError("The intake manifest must use .json, .yaml, or .yml.");
  }

  let text: string;
  try {
    text = await readFile(path.resolve(manifestPath), "utf8");
  } catch {
    throw new IntakeValidationError("The intake manifest could not be read.");
  }

  const secretFindings = scanForPotentialSecrets(text);
  if (secretFindings.length > 0) {
    throw new IntakeValidationError(
      "The intake manifest contains potential secret-like values and will not be stored.",
      secretFindings.map((finding) => (
        `${finding.kind} at line ${finding.line ?? "unknown"} (${finding.redacted_preview})`
      )),
    );
  }

  let parsed: unknown;
  try {
    if (extension === ".json") {
      parsed = JSON.parse(text) as unknown;
    } else {
      const document = parseDocument(text, {
        prettyErrors: false,
        uniqueKeys: true,
      });
      if (document.errors.length > 0) {
        throw document.errors[0];
      }
      parsed = document.toJS({ maxAliasCount: 20 }) as unknown;
    }
  } catch {
    throw new IntakeValidationError("The intake manifest is not valid JSON or YAML.");
  }

  const issues = await validateAgainstSchema(schemaIds.manifest, parsed);
  if (issues.length > 0) {
    throw new IntakeValidationError("The intake manifest does not match its schema.", issues);
  }
  return parsed as SubmissionManifest;
}
