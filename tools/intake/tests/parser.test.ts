import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fingerprintArtifact } from "../src/fingerprint.js";
import { parseArtifact } from "../src/parser.js";
import { fixturesDirectory, intakeDirectory } from "./helpers/github-mock.js";

async function artifact(name: string): Promise<Buffer> {
  return readFile(path.join(fixturesDirectory, "artifacts", name));
}

describe("platform detection and static parsing", () => {
  it("parses a Dify workflow and counts nodes and edges", async () => {
    const result = parseArtifact(await artifact("valid-dify.yml"), undefined);
    expect(result).toMatchObject({
      platform: "dify",
      parsing_status: "parsed",
      node_count: 2,
      edge_count: 1,
      runtime_status: "untested",
      compatibility_status: "unverified",
      recommended_moderation_status: "needs_review",
    });
  });

  it("parses an n8n workflow and counts connections", async () => {
    const result = parseArtifact(await artifact("valid-n8n.json"), undefined);
    expect(result.platform).toBe("n8n");
    expect(result.node_count).toBe(2);
    expect(result.edge_count).toBe(1);
  });

  it("returns unknown and needs_review for an unsupported format", async () => {
    const result = parseArtifact(await artifact("unsupported.txt"), undefined);
    expect(result.platform).toBe("unknown");
    expect(result.parsing_status).toBe("needs_review");
    expect(result.risk_summary.network_access.status).toBe("unknown");
  });

  it("retains the hint and recommends quarantine for malformed YAML and JSON", async () => {
    const dify = parseArtifact(await artifact("malformed-dify.yml"), "dify");
    const n8n = parseArtifact(await artifact("malformed-n8n.json"), "n8n");
    expect(dify).toMatchObject({
      platform: "dify",
      parsing_status: "needs_review",
      recommended_moderation_status: "quarantined",
      node_count: null,
    });
    expect(n8n).toMatchObject({
      platform: "n8n",
      parsing_status: "needs_review",
      recommended_moderation_status: "quarantined",
      node_count: null,
    });
    expect(dify.warnings).toContain("Parse error category: malformed_yaml. Semantic analysis was not attempted.");
    expect(n8n.warnings).toContain("Parse error category: malformed_json. Semantic analysis was not attempted.");
  });

  it("quarantines invalid UTF-8 for a supported platform hint without semantic analysis", () => {
    const result = parseArtifact(Uint8Array.from([0xc3, 0x28]), "n8n");
    expect(result).toMatchObject({
      platform: "n8n",
      parsing_status: "needs_review",
      recommended_moderation_status: "quarantined",
      nodes: [],
      node_count: null,
    });
    expect(result.warnings).toContain("Parse error category: invalid_utf8. Semantic analysis was not attempted.");
  });

  it("detects code, possible shell APIs, and imported dependencies without executing them", async () => {
    const result = parseArtifact(await artifact("code-execution.yml"), "dify");
    expect(result.signals.code_execution).toHaveLength(1);
    expect(result.signals.shell_execution).toHaveLength(1);
    expect(result.dependencies.other).toContain("fixture_library");
    expect(result.risk_summary.code_execution.status).toBe("detected");
  });

  it("records credential types without copying credential IDs or names", async () => {
    const result = parseArtifact(await artifact("credential-reference.json"), "n8n");
    const serialized = JSON.stringify(result);
    expect(result.signals.credential_references.length).toBeGreaterThan(0);
    expect(serialized).toContain("googleSheetsOAuth2Api");
    expect(serialized).not.toContain("fixture-managed-reference");
    expect(serialized).not.toContain("Fixture OAuth Reference");
  });

  it("detects network and conservative external-write signals", async () => {
    const result = parseArtifact(await artifact("network-external-write.json"), "n8n");
    expect(result.signals.http_or_network.length).toBeGreaterThan(1);
    expect(result.signals.external_writes.map((item) => item.category)).toEqual(expect.arrayContaining([
      "HTTP external write",
      "database external write",
      "messaging external write",
    ]));
    expect(result.signals.hard_coded_identifiers.length).toBeGreaterThan(0);
  });

  it("detects duplicate bytes by SHA-256", async () => {
    const first = fingerprintArtifact(await artifact("valid-dify.yml"), null);
    const duplicate = fingerprintArtifact(await artifact("duplicate-artifact.yml"), null);
    expect(duplicate.sha256).toBe(first.sha256);
  });

  it("quarantines a secret-like value and only reports a redacted preview", async () => {
    const fakeValue = "FAKE_ONLY_FOR_INTAKE_TESTS_12345";
    const result = parseArtifact(await artifact("secret-like-value.yml"), "dify");
    const serialized = JSON.stringify(result);
    expect(result.secret_scan.status).toBe("potential_values_detected");
    expect(result.recommended_moderation_status).toBe("quarantined");
    expect(serialized).not.toContain(fakeValue);
    expect(serialized).toContain("FAK…45");
  });

  it("uses JSON Repair only as an unchanged integrity reference", async () => {
    const repositoryRoot = path.resolve(intakeDirectory, "../..");
    const bytes = await readFile(path.join(
      repositoryRoot,
      "packages/json-repair/source/upstream/DSL/json-repair.yml",
    ));
    const fingerprint = fingerprintArtifact(bytes, "d2d9d3cd13b009b6e57bbe6d39baedc63d6e66ea");
    expect(fingerprint.sha256).toBe("5859d8c833593069cfe781da27d585a24cdbbf5e03a50af56b2ae01045d491ad");
    expect(fingerprint.byte_size).toBe(3244);
    expect(fingerprint.line_count).toBe(142);
    expect(fingerprint.git_blob_sha_matches).toBe(true);
  });
});
