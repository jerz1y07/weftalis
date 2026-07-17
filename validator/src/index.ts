import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { AdapterParseError, getAdapter } from "./adapters/adapter.js";
import { validateLicense } from "./license-validator.js";
import { validateFileReferences } from "./path-validator.js";
import { ReportBuilder, ValidatorExecutionError } from "./result.js";
import { validateSchema } from "./schema-validator.js";
import { scanTextForSecrets } from "./secret-scanner.js";
import { validateSemantics } from "./semantic-validator.js";
import type {
  FileReference,
  ValidationIssue,
  ValidationReport,
  WorkflowManifest,
} from "./types.js";

export { ValidatorExecutionError } from "./result.js";
export type { ValidationReport } from "./types.js";

export interface ValidatePackageOptions {
  schemaPath?: string;
}

interface PackageLocation {
  packageRoot: string;
  manifestPath: string;
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function locatePackage(inputPath: string): Promise<PackageLocation> {
  const absoluteInput = path.resolve(inputPath);
  let inputStats;

  try {
    inputStats = await stat(absoluteInput);
  } catch {
    throw new ValidatorExecutionError(
      `Input path does not exist or cannot be read: ${inputPath}`,
    );
  }

  let packageRoot: string;
  let manifestPath: string;

  if (inputStats.isDirectory()) {
    packageRoot = absoluteInput;
    manifestPath = path.join(absoluteInput, "workflow.yaml");
  } else if (inputStats.isFile()) {
    if (path.basename(absoluteInput) !== "workflow.yaml") {
      throw new ValidatorExecutionError(
        "When a file is provided, it must be named workflow.yaml.",
      );
    }
    packageRoot = path.dirname(absoluteInput);
    manifestPath = absoluteInput;
  } else {
    throw new ValidatorExecutionError(
      "The input must be a Workflow Package folder or a workflow.yaml file.",
    );
  }

  let realRoot: string;
  let realManifest: string;
  try {
    realRoot = await realpath(packageRoot);
    realManifest = await realpath(manifestPath);
  } catch {
    throw new ValidatorExecutionError(
      `Could not read workflow.yaml at ${manifestPath}. Check that the file exists and is readable.`,
    );
  }

  if (!isInside(realRoot, realManifest)) {
    throw new ValidatorExecutionError(
      "workflow.yaml resolves outside the Workflow Package and will not be read.",
    );
  }

  return { packageRoot: realRoot, manifestPath: realManifest };
}

async function findDefaultSchemaPath(): Promise<string> {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDirectory, "../../spec/workflow.schema.json"),
    path.resolve(moduleDirectory, "../../../spec/workflow.schema.json"),
  ];

  for (const candidate of candidates) {
    try {
      const candidateStats = await stat(candidate);
      if (candidateStats.isFile()) {
        return candidate;
      }
    } catch {
      // Try the build-output location next.
    }
  }

  throw new ValidatorExecutionError(
    "Could not find spec/workflow.schema.json. Run the Validator from this repository.",
  );
}

function collectReferences(manifest: WorkflowManifest): FileReference[] {
  const references: FileReference[] = [
    { field: "runtime.source_file", path: manifest.runtime.source_file },
    { field: "files.readme", path: manifest.files.readme },
  ];

  if (manifest.files.example_input) {
    references.push({
      field: "files.example_input",
      path: manifest.files.example_input,
    });
  }
  if (manifest.files.example_output) {
    references.push({
      field: "files.example_output",
      path: manifest.files.example_output,
    });
  }
  return references;
}

function addSecretCheck(
  builder: ReportBuilder,
  secretIssues: ValidationIssue[],
): void {
  builder.addIssues(secretIssues);
  builder.addCheck(
    secretIssues.length === 0 ? "passed" : "failed",
    secretIssues.length === 0
      ? "No likely secrets detected"
      : "Possible hard-coded secrets detected",
  );
}

export async function validatePackage(
  inputPath: string,
  options: ValidatePackageOptions = {},
): Promise<ValidationReport> {
  const location = await locatePackage(inputPath);
  const builder = new ReportBuilder();
  let manifestText: string;

  try {
    manifestText = await readFile(location.manifestPath, "utf8");
  } catch {
    throw new ValidatorExecutionError(
      `Could not read ${location.manifestPath}. Check file permissions and retry.`,
    );
  }

  let parsedManifest: unknown;
  try {
    parsedManifest = parse(manifestText);
    builder.addCheck("passed", "Manifest YAML parsed");
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : "invalid YAML";
    builder.addCheck("failed", "Manifest YAML could not be parsed");
    builder.addIssue({
      severity: "error",
      code: "manifest.invalid-yaml",
      message: `workflow.yaml is not valid YAML: ${detail}`,
      file: "workflow.yaml",
    });
    const manifestSecrets = scanTextForSecrets(
      manifestText,
      location.manifestPath,
      location.packageRoot,
    );
    addSecretCheck(builder, manifestSecrets);
    return builder.build(location.packageRoot, location.manifestPath);
  }

  const schemaPath = options.schemaPath ?? (await findDefaultSchemaPath());
  const schemaIssues = await validateSchema(parsedManifest, schemaPath);
  builder.addIssues(schemaIssues);
  builder.addCheck(
    schemaIssues.length === 0 ? "passed" : "failed",
    schemaIssues.length === 0
      ? "Schema validation passed (Draft 2020-12)"
      : "Schema validation failed",
  );

  if (schemaIssues.length > 0) {
    const manifestSecrets = scanTextForSecrets(
      manifestText,
      location.manifestPath,
      location.packageRoot,
    );
    addSecretCheck(builder, manifestSecrets);
    return builder.build(location.packageRoot, location.manifestPath);
  }

  const manifest = parsedManifest as WorkflowManifest;

  const licenseIssues = validateLicense(manifest.license);
  builder.addIssues(licenseIssues);
  builder.addCheck(
    licenseIssues.length === 0 ? "passed" : "failed",
    licenseIssues.length === 0
      ? "License expression valid"
      : "License expression invalid",
  );

  const pathResult = await validateFileReferences(
    location.packageRoot,
    collectReferences(manifest),
  );
  builder.addIssues(pathResult.issues);
  builder.addCheck(
    pathResult.issues.length === 0 ? "passed" : "failed",
    pathResult.issues.length === 0
      ? "Package paths are safe and referenced files exist"
      : "Package path or file checks failed",
  );

  const sourceFile = pathResult.files.find(
    (file) => file.field === "runtime.source_file",
  );
  builder.addCheck(
    sourceFile ? "passed" : "failed",
    sourceFile ? "Source file exists" : "Source file is unavailable",
  );

  const fileContents = new Map<string, string>();
  fileContents.set(location.manifestPath, manifestText);

  for (const file of pathResult.files) {
    if (fileContents.has(file.absolutePath)) {
      continue;
    }
    try {
      fileContents.set(file.absolutePath, await readFile(file.absolutePath, "utf8"));
    } catch {
      throw new ValidatorExecutionError(
        `A validated Package file could not be read: ${file.path}. Check file permissions and retry.`,
      );
    }
  }

  const secretIssues = [...fileContents.entries()].flatMap(([filePath, content]) =>
    scanTextForSecrets(content, filePath, location.packageRoot),
  );
  addSecretCheck(builder, secretIssues);

  if (sourceFile) {
    const sourceContent = fileContents.get(sourceFile.absolutePath);
    if (sourceContent === undefined) {
      throw new ValidatorExecutionError(
        `The source file could not be read: ${manifest.runtime.source_file}.`,
      );
    }

    try {
      const adapterResult = getAdapter(manifest.runtime.platform).parseSource(
        sourceContent,
        manifest.runtime.source_file,
      );
      builder.addCheck(
        "passed",
        `Platform source parsed: ${manifest.runtime.platform}`,
      );

      const semanticIssues = validateSemantics(
        manifest,
        adapterResult,
        secretIssues.length,
      );
      builder.addIssues(semanticIssues);

      const semanticErrors = semanticIssues.filter(
        (issue) => issue.severity === "error",
      );
      const semanticWarnings = semanticIssues.filter(
        (issue) => issue.severity === "warning",
      );
      builder.addCheck(
        semanticErrors.length > 0
          ? "failed"
          : semanticWarnings.length > 0
            ? "warning"
            : "passed",
        semanticErrors.length > 0
          ? "Permission or safety declarations conflict with detected behavior"
          : semanticWarnings.length > 0
            ? "Static capability detection needs manual review"
            : "Permission and safety declarations match detected behavior",
      );
    } catch (error) {
      if (!(error instanceof AdapterParseError)) {
        throw error;
      }
      builder.addCheck("failed", `Platform source could not be parsed: ${manifest.runtime.platform}`);
      builder.addIssue({
        severity: "error",
        code: "adapter.invalid-source",
        message: error.message,
        file: manifest.runtime.source_file,
      });
    }
  }

  if (!manifest.testing) {
    builder.addCheck("warning", "Testing information not provided");
    builder.addIssue({
      severity: "warning",
      code: "testing.not-provided",
      message: "testing is optional but was not provided. No testing claim can be verified.",
      file: "workflow.yaml",
    });
  }

  return builder.build(location.packageRoot, location.manifestPath);
}
