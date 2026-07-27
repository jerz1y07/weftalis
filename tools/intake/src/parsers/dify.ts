import type { ParsedWorkflow } from "../parser-internal.js";
import {
  asString,
  codeTextSignals,
  collectEnvironmentReferences,
  collectHardCodedIdentifiers,
  emptySignals,
  findCredentialKeys,
  includesAny,
  isRecord,
  safeLabel,
  signal,
  unique,
  walkObject,
} from "../parser-utils.js";

function collectStringValues(value: unknown, matchingKey: RegExp): string[] {
  const results: string[] = [];
  walkObject(value, (nested, key) => {
    if (key && matchingKey.test(key)) {
      const safe = safeLabel(nested);
      if (safe) results.push(safe);
    }
  });
  return unique(results);
}

function writeCategory(value: string): string | null {
  if (includesAny(value, ["email", "gmail", "smtp"])) return "email external write";
  if (includesAny(value, ["slack", "discord", "telegram", "teams", "message", "sms", "twilio"])) return "messaging external write";
  if (includesAny(value, ["postgres", "mysql", "mongodb", "database", "supabase", "pocketbase", "redis"])) return "database external write";
  if (includesAny(value, ["file-write", "filesystem-write", "write-file"])) return "filesystem write";
  if (includesAny(value, ["publish", "wordpress", "twitter", "linkedin", "facebook", "social"])) return "publishing external write";
  return null;
}

export function parseDify(root: Record<string, unknown>): ParsedWorkflow | null {
  if (!isRecord(root.workflow) || !isRecord(root.workflow.graph) || !Array.isArray(root.workflow.graph.nodes)) {
    return null;
  }
  const workflow = root.workflow;
  const graph = workflow.graph as Record<string, unknown>;
  const rawNodes = graph.nodes as unknown[];
  const signals = emptySignals();
  const nodes = [];
  const providers: string[] = [];
  const models: string[] = [];
  const plugins: string[] = [];
  const otherDependencies: string[] = [];
  const warnings: string[] = [];
  const uncertainties: string[] = [];

  for (let index = 0; index < rawNodes.length; index += 1) {
    const rawNode = rawNodes[index];
    if (!isRecord(rawNode)) {
      nodes.push({ id: null, name: null, type: null });
      warnings.push(`Node ${index + 1} is not an object and needs manual review.`);
      continue;
    }
    const data = isRecord(rawNode.data) ? rawNode.data : {};
    const id = safeLabel(rawNode.id);
    const name = safeLabel(data.title) ?? safeLabel(data.name);
    const type = safeLabel(data.type);
    const typeLower = type?.toLowerCase() ?? "";
    const nodeLocation = `$.workflow.graph.nodes[${index}]`;
    nodes.push({ id, name, type });

    if (typeLower === "code") {
      signals.code_execution.push(signal(
        "code execution node",
        name,
        type,
        "A Dify Code node is present; embedded code and platform isolation require direct review.",
        nodeLocation,
      ));
      const code = asString(data.code);
      if (code) {
        const codeSignals = codeTextSignals(code, name, type, `${nodeLocation}.data.code`);
        signals.shell_execution.push(...codeSignals.shell);
        signals.http_or_network.push(...codeSignals.network);
        otherDependencies.push(...codeSignals.dependencies);
      }
    }

    const modelNode = includesAny(typeLower, ["llm", "model", "agent", "question-classifier", "parameter-extractor"]);
    if (modelNode) {
      signals.model_or_llm.push(signal(
        "model or LLM node",
        name,
        type,
        "A model-related Dify node is present; provider calls and data transmission are unverified.",
        nodeLocation,
      ));
      signals.http_or_network.push(signal(
        "model-provider network capability",
        name,
        type,
        "The node may contact a configured model provider or local model endpoint.",
        nodeLocation,
      ));
    }

    const nodeProviders = collectStringValues(data, /^(?:provider|provider_name)$/i);
    providers.push(...nodeProviders);
    for (const provider of nodeProviders) {
      signals.provider_references.push(signal(
        "provider reference",
        name,
        type,
        `Node configuration references provider ${provider}.`,
        nodeLocation,
      ));
    }
    models.push(...collectStringValues(data, /^(?:model|model_name)$/i));

    if (includesAny(typeLower, ["http-request", "http_request", "tool", "knowledge-retrieval", "agent"])) {
      signals.http_or_network.push(signal(
        "network-capable node",
        name,
        type,
        "This Dify node type may contact a URL, provider, plugin, or knowledge service.",
        nodeLocation,
      ));
    }
    const combinedType = `${typeLower} ${nodeProviders.join(" ").toLowerCase()} ${safeLabel(data.tool_name)?.toLowerCase() ?? ""}`;
    const externalWriteCategory = writeCategory(combinedType);
    if (externalWriteCategory) {
      signals.external_writes.push(signal(
        externalWriteCategory,
        name,
        type,
        "The node appears capable of changing external state; operation-level behavior is not proven statically.",
        nodeLocation,
      ));
    }

    if (includesAny(typeLower, ["trigger", "webhook"])) {
      signals.webhooks_or_triggers.push(signal(
        typeLower.includes("webhook") ? "webhook" : "trigger",
        name,
        type,
        "A trigger-capable node may initiate execution; exposure and authentication are unverified.",
        nodeLocation,
      ));
    }
    if (includesAny(typeLower, ["human", "approval", "review", "wait-for-input"])) {
      signals.human_review_or_approval.push(signal(
        "possible human checkpoint",
        name,
        type,
        "A human/approval-related node is present; graph paths must be reviewed before treating it as an enforced gate.",
        nodeLocation,
      ));
    }

    signals.credential_references.push(...findCredentialKeys(data, name, type, `${nodeLocation}.data`));
    signals.environment_variable_references.push(
      ...collectEnvironmentReferences(data, name, type, `${nodeLocation}.data`),
    );
    signals.hard_coded_identifiers.push(
      ...collectHardCodedIdentifiers(data, name, type, `${nodeLocation}.data`),
    );
  }

  if (Array.isArray(root.dependencies)) {
    for (const dependency of root.dependencies) {
      if (typeof dependency === "string") {
        const safe = safeLabel(dependency);
        if (safe) plugins.push(safe);
      } else if (isRecord(dependency)) {
        plugins.push(...collectStringValues(dependency, /(?:plugin_unique_identifier|plugin_id|identifier|name)$/i));
      }
    }
  }
  for (const plugin of unique(plugins)) {
    signals.required_plugins_or_custom_nodes.push(signal(
      "declared plugin",
      null,
      null,
      `Dify dependency metadata references plugin ${plugin}.`,
      "$.dependencies",
    ));
  }

  const environmentVariables = Array.isArray(workflow.environment_variables)
    ? workflow.environment_variables
    : [];
  for (let index = 0; index < environmentVariables.length; index += 1) {
    const variable = environmentVariables[index];
    const name = isRecord(variable)
      ? safeLabel(variable.name) ?? safeLabel(variable.variable) ?? "unnamed"
      : "unnamed";
    signals.environment_variable_references.push(signal(
      "declared environment variable",
      null,
      null,
      `Dify declares environment variable ${name}; no value was copied into this report.`,
      `$.workflow.environment_variables[${index}]`,
    ));
  }

  const app = isRecord(root.app) ? root.app : {};
  const kind = safeLabel(root.kind);
  const mode = safeLabel(app.mode);
  const version = safeLabel(root.version);
  const edges = Array.isArray(graph.edges) ? graph.edges.length : 0;
  if (!Array.isArray(graph.edges)) {
    warnings.push("workflow.graph.edges is absent or not an array; the edge count may be incomplete.");
  }
  if (signals.credential_references.length > 0) {
    uncertainties.push("Credential/provider configuration was recorded by key only; values were intentionally not copied.");
  }
  uncertainties.push("Dify node and plugin semantics evolve; custom tools and indirect capabilities may not be classified.");

  return {
    platform: "dify",
    applicationOrWorkflowType: [kind, mode].filter(Boolean).join(" / ") || "Dify workflow",
    schemaIndicators: version ? [`dsl-version:${version}`] : [],
    nodes,
    nodeCount: rawNodes.length,
    edgeCount: edges,
    signals,
    dependencies: {
      providers: unique(providers),
      models: unique(models),
      plugins: unique(plugins),
      custom_nodes: [],
      other: unique(otherDependencies),
    },
    warnings: unique(warnings),
    uncertainties: unique(uncertainties),
  };
}
