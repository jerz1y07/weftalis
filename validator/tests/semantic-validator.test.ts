import { describe, expect, it } from "vitest";

import { validateSemantics } from "../src/semantic-validator.js";
import type { AdapterResult, WorkflowManifest } from "../src/types.js";

function manifest(): WorkflowManifest {
  return {
    spec_version: "0.1",
    id: "semantic-check",
    name: "Semantic check",
    version: "1.0.0",
    description: "Checks semantic validation.",
    author: "Tests",
    license: "MIT",
    runtime: { platform: "n8n", minimum_version: "1.0.0", source_file: "workflow.json" },
    inputs: [],
    outputs: [],
    dependencies: { services: [], models: [], tools: [] },
    permissions: {
      network_access: false,
      filesystem_read: false,
      filesystem_write: false,
      email_send: false,
      social_publish: false,
      code_execution: false,
      credential_access: false,
    },
    human_review: { required: false, checkpoints: [] },
    safety: {
      stores_user_data: false,
      sends_data_externally: false,
      contains_credentials: false,
      risk_level: "low",
    },
    files: { readme: "README.md" },
  };
}

describe("semantic declarations", () => {
  it("warns when a true permission is not detected", () => {
    const value = manifest();
    value.permissions.code_execution = true;
    const adapterResult: AdapterResult = {
      detectedCapabilities: new Set(),
      unknownNodes: [],
      sendsDataExternally: false,
    };

    const issues = validateSemantics(value, adapterResult, 0);
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "permission.not-detected",
      }),
    );
    expect(issues.some((issue) => issue.severity === "error")).toBe(false);
  });

  it("errors on undeclared network, credential, external-data, and secret evidence", () => {
    const adapterResult: AdapterResult = {
      detectedCapabilities: new Set(["network_access", "credential_access"]),
      unknownNodes: [],
      sendsDataExternally: true,
    };

    const issues = validateSemantics(manifest(), adapterResult, 1);
    expect(issues.filter((issue) => issue.code === "permission.undeclared-capability")).toHaveLength(2);
    expect(issues.some((issue) => issue.code === "safety.external-data-mismatch")).toBe(true);
    expect(issues.some((issue) => issue.code === "safety.credential-mismatch")).toBe(true);
  });
});
