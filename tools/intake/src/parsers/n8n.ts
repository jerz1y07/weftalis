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

function countConnections(connections: Record<string, unknown>): number {
  let count = 0;
  walkObject(connections, (value) => {
    if (isRecord(value) && typeof value.node === "string" && typeof value.type === "string") {
      count += 1;
    }
  });
  return count;
}

function operation(parameters: Record<string, unknown>): string {
  return [parameters.operation, parameters.resource, parameters.method, parameters.requestMethod]
    .filter((value): value is string => typeof value === "string")
    .join("/")
    .toLowerCase();
}

function providerFromType(type: string): string | null {
  const mappings: Array<[string[], string]> = [
    [["openai"], "OpenAI"],
    [["anthropic", "claude"], "Anthropic"],
    [["gemini", "googlevertex", "googlepalm"], "Google AI"],
    [["ollama"], "Ollama"],
    [["openrouter"], "OpenRouter"],
    [["azureopenai"], "Azure OpenAI"],
    [["mistral"], "Mistral"],
    [["cohere"], "Cohere"],
  ];
  return mappings.find(([fragments]) => includesAny(type, fragments))?.[1] ?? null;
}

function stringParameter(parameters: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = safeLabel(parameters[key]);
    if (value) return value;
  }
  return null;
}

export function parseN8n(root: Record<string, unknown>): ParsedWorkflow | null {
  if (!Array.isArray(root.nodes) || !isRecord(root.connections)) return null;

  const signals = emptySignals();
  const nodes = [];
  const providers: string[] = [];
  const models: string[] = [];
  const plugins: string[] = [];
  const customNodes: string[] = [];
  const otherDependencies: string[] = [];
  const warnings: string[] = [];
  const uncertainties: string[] = [];

  for (let index = 0; index < root.nodes.length; index += 1) {
    const rawNode = root.nodes[index];
    if (!isRecord(rawNode)) {
      nodes.push({ id: null, name: null, type: null });
      warnings.push(`Node ${index + 1} is not an object and needs manual review.`);
      continue;
    }
    const id = safeLabel(rawNode.id);
    const name = safeLabel(rawNode.name);
    const type = safeLabel(rawNode.type);
    const typeLower = type?.toLowerCase() ?? "";
    const parameters = isRecord(rawNode.parameters) ? rawNode.parameters : {};
    const nodeLocation = `$.nodes[${index}]`;
    nodes.push({ id, name, type });

    const codeNode = includesAny(typeLower, [".code", ".function", "functionitem"]);
    const shellNode = includesAny(typeLower, ["executecommand", "ssh"]);
    const modelNode = includesAny(typeLower, [
      "lmchat",
      "languagemodel",
      "openai",
      "anthropic",
      "ollama",
      "mistral",
      "cohere",
      "agent",
      "llmchain",
    ]);
    const httpNode = typeLower.includes("httprequest");
    const webhookOrTrigger = typeLower.includes("webhook") || typeLower.endsWith("trigger");

    if (codeNode) {
      signals.code_execution.push(signal(
        "code execution node",
        name,
        type,
        "n8n Code/Function node is present; its presence does not prove which path executes.",
        nodeLocation,
      ));
      const code = [parameters.jsCode, parameters.functionCode, parameters.code]
        .find((value): value is string => typeof value === "string");
      if (code) {
        const codeSignals = codeTextSignals(code, name, type, `${nodeLocation}.parameters`);
        signals.shell_execution.push(...codeSignals.shell);
        signals.http_or_network.push(...codeSignals.network);
        otherDependencies.push(...codeSignals.dependencies);
      }
    }

    if (shellNode) {
      signals.code_execution.push(signal(
        "command-capable node",
        name,
        type,
        "This n8n node can invoke commands or a remote shell; configuration and reachability require review.",
        nodeLocation,
      ));
      signals.shell_execution.push(signal(
        "shell execution node",
        name,
        type,
        "A shell/command-capable node is present; node presence does not prove it runs.",
        nodeLocation,
      ));
    }

    if (modelNode) {
      signals.model_or_llm.push(signal(
        "model or LLM node",
        name,
        type,
        "A model/agent-related node is present; provider behavior and transmitted data are unverified.",
        nodeLocation,
      ));
      signals.http_or_network.push(signal(
        "model-provider network capability",
        name,
        type,
        "The node may contact a model provider or local model endpoint.",
        nodeLocation,
      ));
      const provider = providerFromType(typeLower);
      if (provider) {
        providers.push(provider);
        signals.provider_references.push(signal(
          "provider reference",
          name,
          type,
          `Node type references provider ${provider}.`,
          `${nodeLocation}.type`,
        ));
      }
      const model = stringParameter(parameters, ["modelName", "model", "modelId"]);
      if (model) models.push(model);
    }

    if (httpNode) {
      signals.http_or_network.push(signal(
        "HTTP request node",
        name,
        type,
        "An HTTP-capable node is present; method, destination, and data flow require human review.",
        nodeLocation,
      ));
      if (/\b(?:post|put|patch|delete)\b/.test(operation(parameters))) {
        signals.external_writes.push(signal(
          "HTTP external write",
          name,
          type,
          "The configured HTTP method is commonly write-capable; runtime behavior remains untested.",
          nodeLocation,
        ));
      }
    }

    const lowerOperation = operation(parameters);
    if (includesAny(typeLower, ["writebinaryfile", "writefiletodisk", "writefile"])) {
      signals.external_writes.push(signal(
        "filesystem write",
        name,
        type,
        "A filesystem-write-capable node is present.",
        nodeLocation,
      ));
    }
    if (!webhookOrTrigger && includesAny(typeLower, ["gmail", "sendemail", "smtp", ".email"])) {
      signals.http_or_network.push(signal("email service access", name, type, "Email-capable service node is present.", nodeLocation));
      if (!/\b(?:get|getall|read|search|list)\b/.test(lowerOperation)) {
        signals.external_writes.push(signal(
          "email external write",
          name,
          type,
          "The email-capable node may send or modify external messages.",
          nodeLocation,
        ));
      }
    }
    if (!webhookOrTrigger && includesAny(typeLower, ["postgres", "mysql", "mongodb", "redis", "mssql", "supabase", "pocketbase"])) {
      signals.http_or_network.push(signal("database access", name, type, "A database-capable node is present.", nodeLocation));
      if (!/\b(?:select|get|getall|read|search|list|find)\b/.test(lowerOperation)) {
        signals.external_writes.push(signal(
          "database external write",
          name,
          type,
          "The database-capable node may change external state; operation semantics require review.",
          nodeLocation,
        ));
      }
    }
    if (!webhookOrTrigger && includesAny(typeLower, ["slack", "discord", "telegram", "twilio", "teams", "mattermost"])) {
      signals.http_or_network.push(signal("messaging service access", name, type, "A messaging-capable node is present.", nodeLocation));
      if (!/\b(?:get|getall|read|search|list)\b/.test(lowerOperation)) {
        signals.external_writes.push(signal(
          "messaging external write",
          name,
          type,
          "The messaging node may send or modify content outside the workflow runtime.",
          nodeLocation,
        ));
      }
    }
    if (!webhookOrTrigger && includesAny(typeLower, ["googlesheets", "microsoftexcel", "airtable", "notion", "wordpress", "facebook", "linkedin", "twitter", "xnode"])) {
      signals.http_or_network.push(signal("external service access", name, type, "An external data or publishing service node is present.", nodeLocation));
      if (!/\b(?:get|getall|read|search|list|lookup)\b/.test(lowerOperation)) {
        signals.external_writes.push(signal(
          includesAny(typeLower, ["wordpress", "facebook", "linkedin", "twitter", "xnode"])
            ? "publishing external write"
            : "external data write",
          name,
          type,
          "The node may create, update, append, publish, or delete external data.",
          nodeLocation,
        ));
      }
    }

    if (webhookOrTrigger) {
      signals.webhooks_or_triggers.push(signal(
        typeLower.includes("webhook") ? "webhook" : "trigger",
        name,
        type,
        "A webhook or trigger node may initiate execution; exposure and authentication are unverified.",
        nodeLocation,
      ));
    }
    if (includesAny(typeLower, ["approval", "humanintheloop", ".wait", "formwait", "sendandwait"])) {
      signals.human_review_or_approval.push(signal(
        "possible human checkpoint",
        name,
        type,
        "A wait/approval-related node may involve a person; static presence does not prove an enforceable approval gate.",
        nodeLocation,
      ));
    }

    const credentialSignals = findCredentialKeys(rawNode.credentials, name, type, `${nodeLocation}.credentials`);
    if (isRecord(rawNode.credentials)) {
      for (const credentialType of Object.keys(rawNode.credentials)) {
        credentialSignals.push(signal(
          "credential type reference",
          name,
          type,
          `References n8n credential type "${credentialType}"; credential IDs and names were not copied.`,
          `${nodeLocation}.credentials.${credentialType}`,
        ));
      }
    }
    signals.credential_references.push(...credentialSignals);
    signals.environment_variable_references.push(
      ...collectEnvironmentReferences(parameters, name, type, `${nodeLocation}.parameters`),
    );
    signals.hard_coded_identifiers.push(
      ...collectHardCodedIdentifiers(parameters, name, type, `${nodeLocation}.parameters`),
    );

    if (type && !type.startsWith("n8n-nodes-base.") && !type.startsWith("@n8n/n8n-nodes-langchain.")) {
      customNodes.push(type);
      const packageName = type.split(".")[0];
      if (packageName) plugins.push(packageName);
      signals.required_plugins_or_custom_nodes.push(signal(
        "custom or community node",
        name,
        type,
        "The node type is outside the recognized n8n built-in namespaces and may require a separately reviewed package.",
        `${nodeLocation}.type`,
      ));
    }
  }

  const schemaIndicators = [
    typeof root.versionId === "string" ? `versionId:${safeLabel(root.versionId)}` : null,
    isRecord(root.settings) && typeof root.settings.executionOrder === "string"
      ? `executionOrder:${safeLabel(root.settings.executionOrder)}`
      : null,
  ].filter((value): value is string => value !== null);

  if (signals.credential_references.length > 0) {
    uncertainties.push("Credential references were identified by key/type only; credential values were intentionally not copied into review metadata.");
  }
  uncertainties.push("n8n node packages and operation semantics evolve; unknown or indirect capabilities may not be classified.");

  return {
    platform: "n8n",
    applicationOrWorkflowType: typeof root.active === "boolean"
      ? `n8n workflow (${root.active ? "exported active" : "exported inactive"})`
      : "n8n workflow",
    schemaIndicators: unique(schemaIndicators),
    nodes,
    nodeCount: root.nodes.length,
    edgeCount: countConnections(root.connections),
    signals,
    dependencies: {
      providers: unique(providers),
      models: unique(models),
      plugins: unique(plugins),
      custom_nodes: unique(customNodes),
      other: unique(otherDependencies),
    },
    warnings: unique(warnings),
    uncertainties: unique(uncertainties),
  };
}
