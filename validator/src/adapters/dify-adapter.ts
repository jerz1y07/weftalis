import { parse } from "yaml";

import type {
  AdapterResult,
  PermissionName,
  WorkflowAdapter,
} from "../types.js";

import { AdapterParseError } from "./adapter.js";

interface DifyNode {
  id?: unknown;
  data?: unknown;
}

const recognizedWithoutSensitiveCapabilities = new Set([
  "start",
  "end",
  "answer",
  "if-else",
  "variable-aggregator",
  "template-transform",
  "iteration",
  "loop",
]);

function objectHasCredentialConfiguration(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (/credential|authorization|provider[_-]?config/i.test(key) && nested) {
      return true;
    }
    if (objectHasCredentialConfiguration(nested)) {
      return true;
    }
  }
  return false;
}

export const difyAdapter: WorkflowAdapter = {
  platform: "dify",

  parseSource(content: string, sourcePath: string): AdapterResult {
    let parsed: unknown;
    try {
      parsed = parse(content);
    } catch {
      throw new AdapterParseError(
        `${sourcePath} is not valid Dify YAML. Export the workflow again and retry.`,
      );
    }

    if (!parsed || typeof parsed !== "object") {
      throw new AdapterParseError(`${sourcePath} must contain a Dify YAML object.`);
    }

    const root = parsed as Record<string, unknown>;
    const workflow = root.workflow;
    if (!workflow || typeof workflow !== "object") {
      throw new AdapterParseError(`${sourcePath} must contain a workflow object.`);
    }

    const graph = (workflow as Record<string, unknown>).graph;
    if (!graph || typeof graph !== "object") {
      throw new AdapterParseError(`${sourcePath} must contain workflow.graph.`);
    }

    const nodes = (graph as Record<string, unknown>).nodes;
    if (!Array.isArray(nodes)) {
      throw new AdapterParseError(`${sourcePath} must contain workflow.graph.nodes.`);
    }

    const detectedCapabilities = new Set<PermissionName>();
    const unknownNodes: string[] = [];
    let sendsDataExternally = false;

    for (const rawNode of nodes) {
      if (!rawNode || typeof rawNode !== "object") {
        unknownNodes.push("node without an object definition");
        continue;
      }

      const node = rawNode as DifyNode;
      const data = node.data && typeof node.data === "object"
        ? (node.data as Record<string, unknown>)
        : {};
      const type = typeof data.type === "string" ? data.type.toLowerCase() : "";
      let known = false;

      if (type === "http-request" || type === "http_request") {
        detectedCapabilities.add("network_access");
        sendsDataExternally = true;
        known = true;
      }

      if (type === "code") {
        detectedCapabilities.add("code_execution");
        known = true;
      }

      if (objectHasCredentialConfiguration(data)) {
        detectedCapabilities.add("credential_access");
        known = true;
      }

      if (recognizedWithoutSensitiveCapabilities.has(type)) {
        known = true;
      }

      if (!known) {
        const id = typeof node.id === "string" ? node.id : "unnamed node";
        unknownNodes.push(`${id} (${type || "missing type"})`);
      }
    }

    return { detectedCapabilities, unknownNodes, sendsDataExternally };
  },
};
