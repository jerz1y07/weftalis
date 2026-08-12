import type { RiskItem, StaticAuditResult, StaticSignals } from "./types.js";

function evidence(signals: StaticSignals[keyof StaticSignals]): string[] {
  return signals.slice(0, 20).map((item) => {
    const node = item.node_name ?? item.node_type ?? "artifact-level signal";
    return `${node}: ${item.detail}`;
  });
}

function signalRisk(
  signals: StaticSignals[keyof StaticSignals],
  parsed: boolean,
  caution: string,
): RiskItem {
  return {
    status: signals.length > 0 ? "detected" : parsed ? "not_detected" : "unknown",
    evidence: evidence(signals),
    caution,
  };
}

export function buildRiskSummary(
  signals: StaticSignals,
  dependencies: StaticAuditResult["dependencies"],
  secretScan: StaticAuditResult["secret_scan"],
  parsed: boolean,
): StaticAuditResult["risk_summary"] {
  const dependencyValues = [
    ...dependencies.providers.map((value) => `provider: ${value}`),
    ...dependencies.models.map((value) => `model: ${value}`),
    ...dependencies.plugins.map((value) => `plugin: ${value}`),
    ...dependencies.custom_nodes.map((value) => `custom node: ${value}`),
    ...dependencies.other.map((value) => `other: ${value}`),
  ];
  return {
    code_execution: signalRisk(
      signals.code_execution,
      parsed,
      "A Code-node signal does not establish what code will run or whether platform isolation is sufficient.",
    ),
    shell_execution: signalRisk(
      signals.shell_execution,
      parsed,
      "Shell-related text is heuristic evidence and requires direct human inspection.",
    ),
    network_access: signalRisk(
      signals.http_or_network,
      parsed,
      "Node presence cannot prove the destination, transmitted data, reachability, or runtime behavior.",
    ),
    credential_requirements: signalRisk(
      signals.credential_references,
      parsed,
      "Credential references are recorded without values and must be configured through platform-managed storage.",
    ),
    external_writes: signalRisk(
      signals.external_writes,
      parsed,
      "External-write classification is conservative and may include read-only configurations or miss indirect writes.",
    ),
    personal_or_hard_coded_identifiers: signalRisk(
      signals.hard_coded_identifiers,
      parsed,
      "Values are redacted in this report; reviewers must inspect the preserved artifact directly.",
    ),
    secret_scan_results: {
      status: secretScan.status === "potential_values_detected"
        ? "detected"
        : secretScan.status === "not_scanned"
          ? "unknown"
          : "not_detected",
      evidence: secretScan.findings.map((finding) => `${finding.kind} at line ${finding.line ?? "unknown"} (${finding.redacted_preview})`),
      caution: "Secret scanning is heuristic and can produce false positives and false negatives.",
    },
    dependency_declarations: {
      status: dependencyValues.length > 0 ? "detected" : parsed ? "not_detected" : "unknown",
      evidence: dependencyValues,
      caution: "Static declarations may be incomplete, unpinned, unavailable, or different from runtime dependencies.",
    },
  };
}
