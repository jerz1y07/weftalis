import path from "node:path";

import type { ValidationIssue } from "./types.js";

interface SecretPattern {
  name: string;
  expression: RegExp;
  valueGroup: number;
}

const patterns: SecretPattern[] = [
  {
    name: "OpenAI API key",
    expression: /\b(sk-(?:proj-)?[A-Za-z0-9_-]{16,})\b/g,
    valueGroup: 1,
  },
  {
    name: "GitHub token",
    expression: /\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g,
    valueGroup: 1,
  },
  {
    name: "AWS access key",
    expression: /\b(AKIA[0-9A-Z]{16})\b/g,
    valueGroup: 1,
  },
  {
    name: "Bearer token",
    expression: /\bBearer\s+([A-Za-z0-9._~+/-]{12,}=*)/gi,
    valueGroup: 1,
  },
  {
    name: "private key",
    expression: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g,
    valueGroup: 1,
  },
  {
    name: "credential assignment",
    expression: /\b(?:password|api[_-]?key|token|secret)\s*[:=]\s*["']?([^\s"'#,;}]{8,})/gi,
    valueGroup: 1,
  },
];

function redact(value: string): string {
  if (value.length <= 5) {
    return "***";
  }
  return `${value.slice(0, 3)}…${value.slice(-2)}`;
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

export function scanTextForSecrets(
  content: string,
  filePath: string,
  packageRoot: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const displayPath = path.relative(packageRoot, filePath) || "workflow.yaml";

  for (const pattern of patterns) {
    pattern.expression.lastIndex = 0;
    for (const match of content.matchAll(pattern.expression)) {
      const value = match[pattern.valueGroup];
      if (!value || match.index === undefined) {
        continue;
      }

      issues.push({
        severity: "error",
        code: "secret.detected",
        message: `Possible ${pattern.name} detected (${redact(value)}). Remove it and use the platform's secure credential storage.`,
        file: displayPath,
        line: lineNumberAt(content, match.index),
      });
    }
  }

  return issues;
}
