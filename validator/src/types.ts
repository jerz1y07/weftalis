export type Platform = "n8n" | "dify";

export const permissionNames = [
  "network_access",
  "filesystem_read",
  "filesystem_write",
  "email_send",
  "social_publish",
  "code_execution",
  "credential_access",
] as const;

export type PermissionName = (typeof permissionNames)[number];

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
    platform: Platform;
    minimum_version: string;
    source_file: string;
  };
  categories?: string[];
  tags?: string[];
  inputs: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  outputs: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  dependencies: {
    services: string[];
    models: string[];
    tools: string[];
  };
  permissions: Record<PermissionName, boolean>;
  human_review: {
    required: boolean;
    checkpoints: string[];
  };
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
  files: {
    readme: string;
    example_input?: string;
    example_output?: string;
  };
}

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  file?: string;
  line?: number;
}

export type CheckStatus = "passed" | "failed" | "warning";

export interface ValidationCheck {
  status: CheckStatus;
  label: string;
}

export interface ValidationReport {
  packageRoot: string;
  manifestPath: string;
  valid: boolean;
  checks: ValidationCheck[];
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export interface FileReference {
  field: string;
  path: string;
}

export interface ValidatedFile extends FileReference {
  absolutePath: string;
}

export interface AdapterResult {
  detectedCapabilities: Set<PermissionName>;
  unknownNodes: string[];
  sendsDataExternally: boolean;
}

export interface WorkflowAdapter {
  platform: Platform;
  parseSource(content: string, sourcePath: string): AdapterResult;
}
