export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  file?: string;
  line?: number;
}

export interface ValidationReport {
  packageRoot: string;
  manifestPath: string;
  valid: boolean;
  checks: Array<{ status: "passed" | "failed" | "warning"; label: string }>;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export interface WorkflowManifest {
  spec_version: "0.1";
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  repository?: string;
  license: string;
  runtime: {
    platform: "n8n" | "dify";
    minimum_version: string;
    source_file: string;
  };
  categories?: string[];
  tags?: string[];
  inputs: Array<{ name: string; type: string; required: boolean; description: string }>;
  outputs: Array<{ name: string; type: string; description: string }>;
  dependencies: { services: string[]; models: string[]; tools: string[] };
  permissions: {
    network_access: boolean;
    filesystem_read: boolean;
    filesystem_write: boolean;
    email_send: boolean;
    social_publish: boolean;
    code_execution: boolean;
    credential_access: boolean;
  };
  human_review: { required: boolean; checkpoints: string[] };
  safety: {
    stores_user_data: boolean;
    sends_data_externally: boolean;
    contains_credentials: boolean;
    risk_level: "low" | "medium" | "high";
  };
  testing?: {
    status: "untested" | "passed" | "failed";
    last_tested?: string;
    tested_platform_version?: string;
  };
  files: { readme: string; example_input?: string; example_output?: string };
}

export type ValidatePackage = (packagePath: string) => Promise<ValidationReport>;

export interface DiscoveredPackage {
  name: string;
  packageRoot: string;
  manifestPath: string;
}

export interface DiscoveryResult {
  packages: DiscoveredPackage[];
  ignoredTemplates: number;
  ignoredDirectories: number;
}

export interface PublicIssue {
  code: string;
  message: string;
  file: string | null;
  line: number | null;
}

export interface RegistryEntry {
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
  inputs: WorkflowManifest["inputs"];
  outputs: WorkflowManifest["outputs"];
  permissions: WorkflowManifest["permissions"];
  human_review: WorkflowManifest["human_review"];
  safety: WorkflowManifest["safety"];
  testing: WorkflowManifest["testing"] | null;
  package_path: string;
  source_file: string;
  readme_file: string;
  validation: {
    status: "valid";
    errors: PublicIssue[];
    warnings: PublicIssue[];
    checked_at: string;
  };
}

export interface RegistryDocument {
  schema_version: "0.1";
  generated_at: string;
  workflow_count: number;
  workflows: RegistryEntry[];
}

export interface RejectedPackage {
  package_path: string;
  manifest_path: string;
  id: string | null;
  errors: PublicIssue[];
  warnings: PublicIssue[];
}

export interface RejectedDocument {
  schema_version: "0.1";
  generated_at: string;
  rejected_count: number;
  packages: RejectedPackage[];
}

export interface BuildResult {
  registry: RegistryDocument;
  rejected: RejectedDocument;
  discoveredCount: number;
  ignoredTemplates: number;
  ignoredDirectories: number;
}
