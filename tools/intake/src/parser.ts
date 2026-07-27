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

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text) as unknown;
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function parseYaml(text: string): Record<string, unknown> | null {
  try {
    const document = parseDocument(text, {
      prettyErrors: false,
      uniqueKeys: true,
    });
    if (document.errors.length > 0) return null;
    const value = document.toJS({ maxAliasCount: 20 }) as unknown;
    return isRecord(value) ? value : null;
  } catch {
    return null;
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
    recommended_moderation_status: findings.length > 0 ? "quarantined" : "needs_review",
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
    return baseAudit(null, "unknown", true, "The artifact is not valid UTF-8 text and was not parsed.");
  }

  const json = parseJson(text);
  const yaml = parseYaml(text);
  const n8n = json ? parseN8n(json) : null;
  const dify = yaml ? parseDify(yaml) : null;
  if (n8n && dify) {
    return baseAudit(text, "unknown", true, "The artifact matches more than one supported platform shape.");
  }
  if (n8n) return completeAudit(n8n, text);
  if (dify) return completeAudit(dify, text);

  const hintedPlatform = platformHint === "dify" || platformHint === "n8n"
    ? platformHint
    : "unknown";
  const warning = platformHint === "n8n" && json === null
    ? "The artifact was hinted as n8n but is malformed JSON."
    : platformHint === "dify" && yaml === null
      ? "The artifact was hinted as Dify but is malformed YAML."
      : "The artifact is unsupported, ambiguous, or does not match the supported Dify/n8n shapes.";
  return baseAudit(text, hintedPlatform, true, warning);
}

export function createUnavailableAudit(platformHint: Platform | undefined): StaticAuditResult {
  const platform = platformHint === "dify" || platformHint === "n8n" ? platformHint : "unknown";
  return baseAudit(null, platform, false, "The upstream artifact was unavailable, so static parsing was not performed.");
}
