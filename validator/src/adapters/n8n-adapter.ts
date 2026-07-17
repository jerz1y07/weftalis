import type {
  AdapterResult,
  PermissionName,
  WorkflowAdapter,
} from "../types.js";

import { AdapterParseError } from "./adapter.js";

interface N8nNode {
  name?: unknown;
  type?: unknown;
  credentials?: unknown;
}

const recognizedWithoutSensitiveCapabilities = [
  "manualtrigger",
  "start",
  "noop",
  "set",
  "merge",
  "switch",
  "if",
  "webhook",
  "respondtowebhook",
];

function includesAny(value: string, fragments: string[]): boolean {
  return fragments.some((fragment) => value.includes(fragment));
}

function inspectNode(
  node: N8nNode,
  detected: Set<PermissionName>,
): { known: boolean; sendsDataExternally: boolean } {
  const type = typeof node.type === "string" ? node.type.toLowerCase() : "";
  let known = false;
  let sendsDataExternally = false;

  if (includesAny(type, ["httprequest"])) {
    detected.add("network_access");
    sendsDataExternally = true;
    known = true;
  }

  if (includesAny(type, ["sendemail", "gmail", "email", "smtp"])) {
    detected.add("email_send");
    detected.add("network_access");
    sendsDataExternally = true;
    known = true;
  }

  if (includesAny(type, ["readbinaryfile", "readfilefromdisk", "readfile"])) {
    detected.add("filesystem_read");
    known = true;
  }

  if (includesAny(type, ["writebinaryfile", "writefiletodisk", "writefile"])) {
    detected.add("filesystem_write");
    known = true;
  }

  if (includesAny(type, ["function", ".code", "executecommand"])) {
    detected.add("code_execution");
    known = true;
  }

  if (
    node.credentials &&
    typeof node.credentials === "object" &&
    Object.keys(node.credentials).length > 0
  ) {
    detected.add("credential_access");
    known = true;
  }

  if (recognizedWithoutSensitiveCapabilities.some((item) => type.endsWith(item))) {
    known = true;
  }

  return { known, sendsDataExternally };
}

export const n8nAdapter: WorkflowAdapter = {
  platform: "n8n",

  parseSource(content: string, sourcePath: string): AdapterResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AdapterParseError(
        `${sourcePath} is not valid n8n JSON. Export the workflow again and retry.`,
      );
    }

    if (!parsed || typeof parsed !== "object") {
      throw new AdapterParseError(`${sourcePath} must contain an n8n JSON object.`);
    }

    const source = parsed as Record<string, unknown>;
    if (!Array.isArray(source.nodes)) {
      throw new AdapterParseError(`${sourcePath} must contain a nodes array.`);
    }
    if (!source.connections || typeof source.connections !== "object" || Array.isArray(source.connections)) {
      throw new AdapterParseError(`${sourcePath} must contain a connections object.`);
    }

    const detectedCapabilities = new Set<PermissionName>();
    const unknownNodes: string[] = [];
    let sendsDataExternally = false;

    for (const rawNode of source.nodes) {
      if (!rawNode || typeof rawNode !== "object") {
        unknownNodes.push("node without an object definition");
        continue;
      }

      const node = rawNode as N8nNode;
      const inspection = inspectNode(node, detectedCapabilities);
      sendsDataExternally ||= inspection.sendsDataExternally;

      if (!inspection.known) {
        const name = typeof node.name === "string" ? node.name : "unnamed node";
        const type = typeof node.type === "string" ? node.type : "missing type";
        unknownNodes.push(`${name} (${type})`);
      }
    }

    return { detectedCapabilities, unknownNodes, sendsDataExternally };
  },
};
