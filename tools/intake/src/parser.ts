import { parseDocument } from "yaml";

import type { ParsedWorkflow } from "./parser-internal.js";
import { emptySignals, isRecord, unique } from "./parser-utils.js";
import { parseDify } from "./parsers/dify.js";
import { parseN8n } from "./parsers/n8n.js";
import { buildRiskSummary } from "./risk-summary.js";
import { scanForPotentialSecrets } from "./secret-scanner.js";
import type { Platform, StaticAuditResult } from "./types.js";

const limitations = [
  "This report is static, heuristic evidence for human review; it is not a safety certification.",
  "No workflow, node, embedded code, platform, plugin, model, or third-party binary was executed.",
  "Node presence does not prove runtime behavior, reachability, data flow, safety, or side effects.",
  "A signal not detected may still be present indirectly, dynamically, obfuscated, or in an unsupported node.",
  "A passed static check does not mean safe, executable, compatible, production ready, or runtime tested.",
];

interface SyntaxResult {
  value: Record<string, unknown> | null;
  malformed: boolean;
}

function parseJson(text: string): SyntaxResult {
  try {
    const value = JSON.parse(text) as unknown;
    return { value: isRecord(value) ? value : null, malformed: false };
  } catch {
    return { value: null, malformed: true };
  }
}

function parseYaml(text: string): SyntaxResult {
  try {
    const document = parseDocument(text, {
      prettyErrors: false,
      uniqueKeys: true,
    });
    if (document.errors.length > 0) return { value: null, malformed: true };
    const value = document.toJS({ maxAliasCount: 20 }) as unknown;
    return { value: isRecord(value) ? value : null, malformed: false };
  } catch {
    return { value: null, malformed: true };
  }
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function baseAudit(
  text: string | null,
  platform: Platform,
  artifactAvailable: boolean,
  warning: string,
  forceQuarantine = false,
): StaticAuditResult {
  const signals = emptySignals();
  const findings = text === null ? [] : scanForPotentialSecrets(text);
  const secretScan: StaticAuditResult["secret_scan"] = {
    status: text === null
      ? "not_scanned"
      : findings.length > 0
        ? "potential_values_detected"
        : "none_detected",
    finding_count: findings.length,
    findings,
    limitations: ["The scan uses a small heuristic pattern set and may miss secrets or flag harmless values."],
  };
  const dependencies: StaticAuditResult["dependencies"] = {
    providers: [],
    models: [],
    plugins: [],
    custom_nodes: [],
    other: [],
  };
  return {
    record_version: "1.0",
    artifact_available: artifactAvailable,
    platform,
    parsing_status: "needs_review",
    application_or_workflow_type: null,
    schema_indicators: [],
    nodes: [],
    node_count: null,
    edge_count: null,
    signals,
    dependencies,
    secret_scan: secretScan,
    risk_summary: buildRiskSummary(signals, dependencies, secretScan, false),
    runtime_status: "untested",
    compatibility_status: "unverified",
    recommended_moderation_status: forceQuarantine || findings.length > 0 ? "quarantined" : "needs_review",
    warnings: [warning],
    uncertainties: ["The artifact could not be classified and requires direct human inspection."],
    limitations,
  };
}

function completeAudit(parsed: ParsedWorkflow, text: string): StaticAuditResult {
  const findings = scanForPotentialSecrets(text);
  const secretScan: StaticAuditResult["secret_scan"] = {
    status: findings.length > 0 ? "potential_values_detected" : "none_detected",
    finding_count: findings.length,
    findings,
    limitations: ["The scan uses a small heuristic pattern set and may miss secrets or flag harmless values."],
  };
  return {
    record_version: "1.0",
    artifact_available: true,
    platform: parsed.platform,
    parsing_status: "parsed",
    application_or_workflow_type: parsed.applicationOrWorkflowType,
    schema_indicators: parsed.schemaIndicators,
    nodes: parsed.nodes,
    node_count: parsed.nodeCount,
    edge_count: parsed.edgeCount,
    signals: parsed.signals,
    dependencies: parsed.dependencies,
    secret_scan: secretScan,
    risk_summary: buildRiskSummary(parsed.signals, parsed.dependencies, secretScan, true),
    runtime_status: "untested",
    compatibility_status: "unverified",
    recommended_moderation_status: findings.length > 0 ? "quarantined" : "needs_review",
    warnings: unique(parsed.warnings),
    uncertainties: unique(parsed.uncertainties),
    limitations,
  };
}

export function parseArtifact(
  bytes: Uint8Array,
  platformHint: Platform | undefined,
): StaticAuditResult {
  const text = decodeUtf8(bytes);
  if (text === null) {
    const hintedPlatform = platformHint === "dify" || platformHint === "n8n" ? platformHint : "unknown";
    return baseAudit(
      null,
      hintedPlatform,
      true,
      "Parse error category: invalid_utf8. Semantic analysis was not attempted.",
      hintedPlatform !== "unknown",
    );
  }

  if (platformHint === "n8n") {
    const json = parseJson(text);
    if (json.malformed) {
      return baseAudit(
        text,
        "n8n",
        true,
        "Parse error category: malformed_json. Semantic analysis was not attempted.",
        true,
      );
    }
    const n8n = json.value ? parseN8n(json.value) : null;
    return n8n
      ? completeAudit(n8n, text)
      : baseAudit(text, "n8n", true, "The artifact does not match the supported n8n workflow shape.");
  }

  if (platformHint === "dify") {
    const yaml = parseYaml(text);
    if (yaml.malformed) {
      return baseAudit(
        text,
        "dify",
        true,
        "Parse error category: malformed_yaml. Semantic analysis was not attempted.",
        true,
      );
    }
    const dify = yaml.value ? parseDify(yaml.value) : null;
    return dify
      ? completeAudit(dify, text)
      : baseAudit(text, "dify", true, "The artifact does not match the supported Dify workflow shape.");
  }

  const json = parseJson(text);
  const looksJson = /^\s*[\[{]/.test(text);
  if (looksJson && json.malformed) {
    return baseAudit(
      text,
      "unknown",
      true,
      "Parse error category: malformed_json. Semantic analysis was not attempted.",
      true,
    );
  }
  const yaml = parseYaml(text);
  if (yaml.malformed) {
    return baseAudit(
      text,
      "unknown",
      true,
      "Parse error category: malformed_yaml. Semantic analysis was not attempted.",
      true,
    );
  }
  const n8n = json.value ? parseN8n(json.value) : null;
  const dify = yaml.value ? parseDify(yaml.value) : null;
  if (n8n && dify) {
    return baseAudit(text, "unknown", true, "The artifact matches more than one supported platform shape.");
  }
  if (n8n) return completeAudit(n8n, text);
  if (dify) return completeAudit(dify, text);

  return baseAudit(text, "unknown", true, "The artifact is unsupported or does not match a supported Dify/n8n shape.");
}

export function createUnavailableAudit(platformHint: Platform | undefined): StaticAuditResult {
  const platform = platformHint === "dify" || platformHint === "n8n" ? platformHint : "unknown";
  return baseAudit(null, platform, false, "The upstream artifact was unavailable, so static parsing was not performed.");
}
