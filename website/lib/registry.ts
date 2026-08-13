import registryJson from "@/generated/registry.json";

export type ValidationStatus = "valid";

export type RegistryField = {
  name: string;
  type: string;
  description: string;
  required?: boolean;
};

export type RegistryPermissions = {
  network_access: boolean;
  filesystem_read: boolean;
  filesystem_write: boolean;
  email_send: boolean;
  social_publish: boolean;
  code_execution: boolean;
  credential_access: boolean;
};

export type RegistryWorkflow = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  platform: string;
  minimum_platform_version: string;
  categories: string[];
  tags: string[];
  inputs: RegistryField[];
  outputs: RegistryField[];
  permissions: RegistryPermissions;
  human_review: {
    required: boolean;
    checkpoints: string[];
  };
  safety: {
    stores_user_data: boolean;
    sends_data_externally: boolean;
    contains_credentials: boolean;
    risk_level: string;
  };
  testing: {
    status: string;
    last_tested?: string;
    tested_platform_version?: string;
  } | null;
  package_path: string;
  source_file: string;
  readme_file: string;
  validation: {
    status: ValidationStatus;
    errors: unknown[];
    warnings: unknown[];
    checked_at: string;
  };
};

export type Registry = {
  schema_version: string;
  generated_at: string;
  workflow_count: number;
  workflows: RegistryWorkflow[];
};

export type MarketplaceWorkflow = {
  summary: string;
  originalCreator: string | null;
  sourceLabel: string;
  sourceUrl: string;
  acquisitionUrl: string;
  listingMaintainer: string;
  limitation: string | null;
  useSteps: string[];
  source: {
    repository: string;
    path: string;
    ref: string;
    attributionBasis: string;
    licenseEvidence: string;
    transformation: string;
    sha256?: string;
  };
};

const PROJECT_REPOSITORY = "https://github.com/jerz1y07/weftalis";
const PROJECT_SOURCE_REF = "f943d0be6ab1eec969fe2149e08dd0b5a2e00c82";

const JSON_REPAIR_UPSTREAM = {
  repository: "https://github.com/svcvit/Awesome-Dify-Workflow",
  path: "DSL/json-repair.yml",
  ref: "e730ed3627e5fa56fc1668d995b83178b6b1181c",
  rawUrl:
    "https://raw.githubusercontent.com/svcvit/Awesome-Dify-Workflow/e730ed3627e5fa56fc1668d995b83178b6b1181c/DSL/json-repair.yml",
  sha256: "5859d8c833593069cfe781da27d585a24cdbbf5e03a50af56b2ae01045d491ad",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string" && record[key].length > 0;
}

function hasBoolean(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "boolean";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRegistryField(value: unknown, input: boolean): value is RegistryField {
  if (!isRecord(value)) return false;
  const hasValidRequiredField = input
    ? typeof value.required === "boolean"
    : value.required === undefined || typeof value.required === "boolean";

  return (
    hasString(value, "name") &&
    hasString(value, "type") &&
    hasString(value, "description") &&
    hasValidRequiredField
  );
}

function isWorkflow(value: unknown): value is RegistryWorkflow {
  if (!isRecord(value)) return false;

  const stringFields = [
    "id",
    "name",
    "version",
    "description",
    "author",
    "license",
    "platform",
    "minimum_platform_version",
    "package_path",
    "source_file",
    "readme_file",
  ];
  if (!stringFields.every((field) => hasString(value, field))) return false;
  if (!isStringArray(value.categories) || !isStringArray(value.tags)) return false;
  if (!Array.isArray(value.inputs) || !value.inputs.every((field) => isRegistryField(field, true))) return false;
  if (!Array.isArray(value.outputs) || !value.outputs.every((field) => isRegistryField(field, false))) return false;

  if (!isRecord(value.permissions)) return false;
  const permissionFields: (keyof RegistryPermissions)[] = [
    "network_access",
    "filesystem_read",
    "filesystem_write",
    "email_send",
    "social_publish",
    "code_execution",
    "credential_access",
  ];
  if (!permissionFields.every((field) => hasBoolean(value.permissions as Record<string, unknown>, field))) return false;

  if (!isRecord(value.human_review)) return false;
  if (!hasBoolean(value.human_review, "required") || !isStringArray(value.human_review.checkpoints)) return false;

  if (!isRecord(value.safety)) return false;
  if (
    !hasBoolean(value.safety, "stores_user_data") ||
    !hasBoolean(value.safety, "sends_data_externally") ||
    !hasBoolean(value.safety, "contains_credentials") ||
    !hasString(value.safety, "risk_level")
  ) return false;

  if (value.testing !== null) {
    if (!isRecord(value.testing) || !hasString(value.testing, "status")) return false;
    if (value.testing.last_tested !== undefined && typeof value.testing.last_tested !== "string") return false;
    if (
      value.testing.tested_platform_version !== undefined &&
      typeof value.testing.tested_platform_version !== "string"
    ) return false;
  }

  if (!isRecord(value.validation)) return false;
  return (
    value.validation.status === "valid" &&
    Array.isArray(value.validation.errors) &&
    Array.isArray(value.validation.warnings) &&
    hasString(value.validation, "checked_at")
  );
}

function assertRegistry(value: unknown): asserts value is Registry {
  if (!isRecord(value)) throw new Error("Generated Registry must be an object.");
  if (!hasString(value, "schema_version")) throw new Error("Generated Registry is missing schema_version.");
  if (!hasString(value, "generated_at")) throw new Error("Generated Registry is missing generated_at.");
  if (!Number.isInteger(value.workflow_count)) throw new Error("Generated Registry has an invalid workflow_count.");
  if (!Array.isArray(value.workflows)) throw new Error("Generated Registry workflows must be an array.");
  if (value.workflow_count !== value.workflows.length) {
    throw new Error("Generated Registry workflow_count does not match workflows.length.");
  }

  const ids = new Set<string>();
  for (const workflow of value.workflows) {
    if (!isWorkflow(workflow)) throw new Error("Generated Registry contains an invalid Workflow entry.");
    if (ids.has(workflow.id)) throw new Error(`Generated Registry contains duplicate id: ${workflow.id}.`);
    ids.add(workflow.id);
  }
}

const registryData: unknown = registryJson;
assertRegistry(registryData);
const registry: Registry = registryData;

export function getRegistry(): Registry {
  return registry;
}

export function getAllWorkflows(): RegistryWorkflow[] {
  return [...registry.workflows].sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  );
}

export function getWorkflowById(id: string): RegistryWorkflow | undefined {
  return registry.workflows.find((workflow) => workflow.id === id);
}

export function getFeaturedWorkflows(): RegistryWorkflow[] {
  return getAllWorkflows();
}

export function getPlatforms(): string[] {
  return [...new Set(registry.workflows.map((workflow) => workflow.platform))].sort();
}

export function getCategories(): string[] {
  return [...new Set(registry.workflows.flatMap((workflow) => workflow.categories))].sort();
}

export function formatPublicLabel(value: string): string {
  if (value === "dify") return "Dify";
  if (value === "n8n") return "n8n";

  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function publicMaintainerName(value: string): string {
  if (value === "Weftalis Contributors") return "Weft Place contributors";
  if (value === "Weftalis maintainers") return "Weft Place maintainers";
  return value;
}

export function getMarketplaceWorkflow(
  workflow: RegistryWorkflow,
): MarketplaceWorkflow {
  if (workflow.id === "json-repair") {
    return {
      summary:
        "Repairs malformed or non-standard JSON text and returns the repaired string.",
      originalCreator: "svcvit",
      sourceLabel: "svcvit/Awesome-Dify-Workflow",
      sourceUrl: `${JSON_REPAIR_UPSTREAM.repository}/blob/${JSON_REPAIR_UPSTREAM.ref}/${JSON_REPAIR_UPSTREAM.path}`,
      acquisitionUrl: JSON_REPAIR_UPSTREAM.rawUrl,
      listingMaintainer: publicMaintainerName(workflow.author),
      limitation: "Requires the external json_repair package, with no version pinned by the workflow.",
      useSteps: [
        "Open the exact upstream Dify artifact with Get workflow.",
        "Inspect the workflow and its embedded Python code before importing it into Dify.",
        "Confirm that the json_repair dependency is available in your runtime, then compare repaired output with the original input.",
      ],
      source: {
        repository: JSON_REPAIR_UPSTREAM.repository,
        path: JSON_REPAIR_UPSTREAM.path,
        ref: JSON_REPAIR_UPSTREAM.ref,
        attributionBasis:
          "Repository publisher identity, pinned README attribution, and introducing commit identity. This does not establish legal identity or sole authorship.",
        licenseEvidence:
          "MIT, based on repository-level license evidence at the pinned revision; no per-file SPDX header was found.",
        transformation: "The listed artifact is byte-identical to upstream; no functional changes are recorded.",
        sha256: JSON_REPAIR_UPSTREAM.sha256,
      },
    };
  }

  const isWritingWorkflow = workflow.id === "human-reviewed-writing-pipeline";
  const sourceUrl = `${PROJECT_REPOSITORY}/blob/${PROJECT_SOURCE_REF}/${workflow.source_file}`;
  const acquisitionUrl = `https://raw.githubusercontent.com/jerz1y07/weftalis/${PROJECT_SOURCE_REF}/${workflow.source_file}`;

  return {
    summary: workflow.description,
    originalCreator: null,
    sourceLabel: "Weft Place repository",
    sourceUrl,
    acquisitionUrl,
    listingMaintainer: publicMaintainerName(workflow.author),
    limitation: isWritingWorkflow
      ? "A person must approve the draft and fact-check notes before final copy is returned."
      : "A person must review the collected evidence before the final summary is assembled.",
    useSteps: isWritingWorkflow
      ? [
          "Open the recorded Dify artifact with Get workflow and inspect it before importing.",
          "Provide source material and a writing brief when you run the workflow.",
          "Review the draft and fact-check notes before approving the final output.",
        ]
      : [
          "Open the recorded n8n artifact with Get workflow and inspect it before importing.",
          "Provide a research topic and the public source URLs you want the workflow to use.",
          "Review the collected evidence before allowing the final summary step.",
        ],
    source: {
      repository: PROJECT_REPOSITORY,
      path: workflow.source_file,
      ref: PROJECT_SOURCE_REF,
      attributionBasis:
        "The Registry records a generic package author but does not independently establish an original creator identity.",
      licenseEvidence: `${workflow.license}, as declared by the Registry package metadata.`,
      transformation: "No separate upstream transformation record is present for this listing.",
    },
  };
}

export function formatRegistryDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}
