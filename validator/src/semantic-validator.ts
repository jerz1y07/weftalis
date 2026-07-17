import {
  permissionNames,
  type AdapterResult,
  type ValidationIssue,
  type WorkflowManifest,
} from "./types.js";

const permissionLabels: Record<(typeof permissionNames)[number], string> = {
  network_access: "external network access",
  filesystem_read: "filesystem reading",
  filesystem_write: "filesystem writing",
  email_send: "email sending",
  social_publish: "social publishing",
  code_execution: "code execution",
  credential_access: "credential access",
};

export function validateSemantics(
  manifest: WorkflowManifest,
  adapterResult: AdapterResult,
  secretCount: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const permission of permissionNames) {
    const detected = adapterResult.detectedCapabilities.has(permission);
    const declared = manifest.permissions[permission];

    if (detected && !declared) {
      issues.push({
        severity: "error",
        code: "permission.undeclared-capability",
        message: `${permission} is declared false, but the platform source contains evidence of ${permissionLabels[permission]}.`,
        file: manifest.runtime.source_file,
      });
    }

    if (!detected && declared) {
      issues.push({
        severity: "warning",
        code: "permission.not-detected",
        message: `${permission} is declared true, but this limited static check did not detect it. Review the source manually.`,
        file: manifest.runtime.source_file,
      });
    }
  }

  if (adapterResult.sendsDataExternally && !manifest.safety.sends_data_externally) {
    issues.push({
      severity: "error",
      code: "safety.external-data-mismatch",
      message: "safety.sends_data_externally is false, but a node that may send data to an external service was detected.",
      file: manifest.runtime.source_file,
    });
  }

  if (secretCount > 0 && !manifest.safety.contains_credentials) {
    issues.push({
      severity: "error",
      code: "safety.credential-mismatch",
      message: "safety.contains_credentials is false, but the secret scanner found possible hard-coded credential material.",
      file: "workflow.yaml",
    });
  }

  if (manifest.safety.contains_credentials) {
    issues.push({
      severity: "warning",
      code: "safety.contains-credentials-declared",
      message: "safety.contains_credentials is true. Registry packages must not store credential values; review every file manually.",
      file: "workflow.yaml",
    });
  }

  for (const unknownNode of adapterResult.unknownNodes) {
    issues.push({
      severity: "warning",
      code: "adapter.unknown-node",
      message: `Unknown ${manifest.runtime.platform} node: ${unknownNode}. Its capabilities could not be verified.`,
      file: manifest.runtime.source_file,
    });
  }

  return issues;
}
