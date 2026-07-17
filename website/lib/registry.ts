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
  return registry.workflows;
}

export function getWorkflowById(id: string): RegistryWorkflow | undefined {
  return registry.workflows.find((workflow) => workflow.id === id);
}

export function getFeaturedWorkflows(): RegistryWorkflow[] {
  return registry.workflows;
}

export function getPlatforms(): string[] {
  return [...new Set(registry.workflows.map((workflow) => workflow.platform))];
}

export function getCategories(): string[] {
  return [...new Set(registry.workflows.flatMap((workflow) => workflow.categories))];
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
