import { describe, expect, it } from "vitest";

import { difyAdapter } from "../src/adapters/dify-adapter.js";
import { n8nAdapter } from "../src/adapters/n8n-adapter.js";

describe("platform adapters", () => {
  it("parses n8n and detects its limited capability set", () => {
    const source = JSON.stringify({
      nodes: [
        { type: "n8n-nodes-base.httpRequest", name: "HTTP" },
        { type: "n8n-nodes-base.readBinaryFile", name: "Read" },
        { type: "n8n-nodes-base.writeBinaryFile", name: "Write" },
        { type: "n8n-nodes-base.code", name: "Code" },
        {
          type: "n8n-nodes-base.gmail",
          name: "Mail",
          credentials: { gmailOAuth2: { id: "managed-reference" } },
        },
      ],
      connections: {},
    });

    const result = n8nAdapter.parseSource(source, "workflow.json");
    expect(result.detectedCapabilities).toEqual(
      new Set([
        "network_access",
        "filesystem_read",
        "filesystem_write",
        "code_execution",
        "email_send",
        "credential_access",
      ]),
    );
    expect(result.sendsDataExternally).toBe(true);
  });

  it("parses Dify and detects HTTP, code, and provider credentials", () => {
    const source = `
workflow:
  graph:
    nodes:
      - id: request
        data:
          type: http-request
          provider_config:
            mode: managed
      - id: code
        data:
          type: code
    edges: []
`;

    const result = difyAdapter.parseSource(source, "workflow.yml");
    expect(result.detectedCapabilities).toEqual(
      new Set(["network_access", "credential_access", "code_execution"]),
    );
    expect(result.sendsDataExternally).toBe(true);
  });
});
