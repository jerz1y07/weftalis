import type { SecretFinding } from "./types.js";

interface SecretPattern {
  kind: string;
  expression: RegExp;
  valueGroup: number;
}

const patterns: SecretPattern[] = [
  {
    kind: "OpenAI-style API key",
    expression: /\b(sk-(?:proj-)?[A-Za-z0-9_-]{16,})\b/g,
    valueGroup: 1,
  },
  {
    kind: "GitHub-style token",
    expression: /\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g,
    valueGroup: 1,
  },
  {
    kind: "AWS access key",
    expression: /\b(AKIA[0-9A-Z]{16})\b/g,
    valueGroup: 1,
  },
  {
    kind: "Bearer token",
    expression: /\bBearer\s+([A-Za-z0-9._~+/-]{12,}=*)/gi,
    valueGroup: 1,
  },
  {
    kind: "private key header",
    expression: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g,
    valueGroup: 1,
  },
  {
    kind: "credential-like assignment",
    expression: /\b(?:password|api[_-]?key|access[_-]?token|auth[_-]?token|secret)\s*[:=]\s*["']?([^\s"'#,;}]{8,})/gi,
    valueGroup: 1,
  },
];

function redactedPreview(value: string): string {
  if (value.length < 8) return "[REDACTED]";
  return `${value.slice(0, 3)}…${value.slice(-2)}`;
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

export function scanForPotentialSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const pattern of patterns) {
    pattern.expression.lastIndex = 0;
    for (const match of text.matchAll(pattern.expression)) {
      const value = match[pattern.valueGroup];
      if (!value || match.index === undefined) continue;
      findings.push({
        kind: pattern.kind,
        line: lineAt(text, match.index),
        redacted_preview: redactedPreview(value),
      });
    }
  }
  return findings;
}
