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

export function redactPotentialSecrets(text: string): string {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const pattern of patterns) {
    pattern.expression.lastIndex = 0;
    for (const match of text.matchAll(pattern.expression)) {
      const value = match[pattern.valueGroup];
      if (!value || match.index === undefined) continue;
      const offset = match[0].indexOf(value);
      if (offset < 0) continue;
      ranges.push({ start: match.index + offset, end: match.index + offset + value.length });
    }
  }
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges.sort((left, right) => left.start - right.start || left.end - right.end)) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  let redacted = text;
  for (const range of merged.reverse()) {
    redacted = `${redacted.slice(0, range.start)}[REDACTED]${redacted.slice(range.end)}`;
  }
  return redacted;
}

export function redactSecretLikeMetadata<T>(value: T): T {
  if (typeof value === "string") return redactPotentialSecrets(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactSecretLikeMetadata(item)) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      redactPotentialSecrets(key),
      redactSecretLikeMetadata(nested),
    ]),
  ) as T;
}
