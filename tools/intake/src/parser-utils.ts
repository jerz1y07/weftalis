import { scanForPotentialSecrets } from "./secret-scanner.js";
import type { AuditSignal, StaticSignals } from "./types.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

export function safeLabel(value: unknown): string | null {
  const stringValue = asString(value);
  if (!stringValue) return null;
  if (scanForPotentialSecrets(stringValue).length > 0) return "[redacted potential secret]";
  return stringValue.length <= 200 ? stringValue : `${stringValue.slice(0, 197)}…`;
}

export function emptySignals(): StaticSignals {
  return {
    code_execution: [],
    shell_execution: [],
    model_or_llm: [],
    provider_references: [],
    credential_references: [],
    environment_variable_references: [],
    http_or_network: [],
    external_writes: [],
    webhooks_or_triggers: [],
    required_plugins_or_custom_nodes: [],
    human_review_or_approval: [],
    hard_coded_identifiers: [],
  };
}

export function signal(
  category: string,
  nodeName: string | null,
  nodeType: string | null,
  detail: string,
  location: string | null = null,
): AuditSignal {
  return {
    category,
    node_name: safeLabel(nodeName),
    node_type: safeLabel(nodeType),
    location,
    detail,
  };
}

export function includesAny(value: string, fragments: string[]): boolean {
  return fragments.some((fragment) => value.includes(fragment));
}

export function walkObject(
  root: unknown,
  visit: (value: unknown, key: string | null, location: string) => void,
  maximumEntries = 20_000,
): boolean {
  const stack: Array<{ value: unknown; key: string | null; location: string }> = [
    { value: root, key: null, location: "$" },
  ];
  let entries = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    entries += 1;
    if (entries > maximumEntries) return false;
    visit(current.value, current.key, current.location);
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({
          value: current.value[index],
          key: String(index),
          location: `${current.location}[${index}]`,
        });
      }
    } else if (isRecord(current.value)) {
      const entriesToAdd = Object.entries(current.value);
      for (let index = entriesToAdd.length - 1; index >= 0; index -= 1) {
        const [key, value] = entriesToAdd[index]!;
        stack.push({ value, key, location: `${current.location}.${key}` });
      }
    }
  }
  return true;
}

function redactedIdentifier(value: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      return `Hard-coded URL host ${parsed.hostname || "[redacted]"}.`;
    } catch {
      return "Hard-coded URL-like value (redacted).";
    }
  }
  if (/^[^\s@]+@[^\s@]+$/.test(value)) {
    return "Hard-coded email-like value (redacted).";
  }
  return value.length < 8
    ? "Hard-coded identifier-like value (redacted)."
    : `Hard-coded identifier-like value ${value.slice(0, 2)}…${value.slice(-2)}.`;
}

function looksConfigured(value: string): boolean {
  const lowered = value.toLowerCase();
  return !(
    value.trim() === ""
    || lowered.includes("placeholder")
    || lowered.includes("example.com")
    || /^<[^>]+>$/.test(value)
    || value.includes("{{")
    || value.includes("${")
    || value.includes("$env")
    || value.startsWith("={{")
  );
}

export function collectHardCodedIdentifiers(
  value: unknown,
  nodeName: string | null,
  nodeType: string | null,
  locationPrefix: string,
): AuditSignal[] {
  const findings: AuditSignal[] = [];
  const sensitiveKey = /(?:^|_)(?:url|uri|email|host|hostname|path|database|spreadsheet|document|channel|workspace|project|tenant)(?:_?id)?$/i;
  const identifierKey = /(?:^|_)(?:credential|account|user|sheet|file|folder|resource|webhook)_?id$/i;
  walkObject(value, (nested, key, location) => {
    if (findings.length >= 50 || key === null || typeof nested !== "string") return;
    if (!(sensitiveKey.test(key) || identifierKey.test(key)) || !looksConfigured(nested)) return;
    findings.push(signal(
      "hard-coded identifier",
      nodeName,
      nodeType,
      redactedIdentifier(nested),
      `${locationPrefix}${location.slice(1)}`,
    ));
  });
  return findings;
}

export function collectEnvironmentReferences(
  value: unknown,
  nodeName: string | null,
  nodeType: string | null,
  locationPrefix: string,
): AuditSignal[] {
  const results: AuditSignal[] = [];
  walkObject(value, (nested, _key, location) => {
    if (typeof nested !== "string") return;
    const names = [
      ...nested.matchAll(/\$env\.([A-Za-z_][A-Za-z0-9_]*)/g),
      ...nested.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g),
      ...nested.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g),
    ].map((match) => match[1]!).filter((name, index, all) => all.indexOf(name) === index);
    for (const name of names) {
      results.push(signal(
        "environment variable reference",
        nodeName,
        nodeType,
        `References environment variable ${name}; no value was recorded.`,
        `${locationPrefix}${location.slice(1)}`,
      ));
    }
  });
  return results;
}

export function findCredentialKeys(
  value: unknown,
  nodeName: string | null,
  nodeType: string | null,
  locationPrefix: string,
): AuditSignal[] {
  const results: AuditSignal[] = [];
  walkObject(value, (nested, key, location) => {
    if (key === null || !/(?:credential|authorization|provider[_-]?config|api[_-]?key)/i.test(key)) return;
    if (nested === null || nested === false || nested === "") return;
    results.push(signal(
      "credential reference",
      nodeName,
      nodeType,
      `Credential-related configuration key "${key}" is present; its value was not copied.`,
      `${locationPrefix}${location.slice(1)}`,
    ));
  });
  return results.slice(0, 50);
}

export function codeTextSignals(
  code: string,
  nodeName: string | null,
  nodeType: string | null,
  location: string,
): { shell: AuditSignal[]; network: AuditSignal[]; dependencies: string[] } {
  const shell = /\b(?:child_process|subprocess|os\.system|shell_exec|execSync|spawnSync|Runtime\.getRuntime)\b/i.test(code)
    ? [signal(
      "possible shell execution",
      nodeName,
      nodeType,
      "Embedded code contains a shell or subprocess API reference; static text does not prove it is reached.",
      location,
    )]
    : [];
  const network = /\b(?:fetch\s*\(|axios\b|requests\.|urllib\.|httpx\.|https?\.request|XMLHttpRequest)\b/i.test(code)
    ? [signal(
      "possible network access",
      nodeName,
      nodeType,
      "Embedded code contains a network-client API reference; static text does not prove a request occurs.",
      location,
    )]
    : [];
  const dependencies = [
    ...code.matchAll(/^\s*(?:import|from)\s+([A-Za-z_][A-Za-z0-9_.-]*)/gm),
    ...code.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1]!).filter((item) => !item.startsWith("node:"));
  return { shell, network, dependencies: unique(dependencies) };
}
