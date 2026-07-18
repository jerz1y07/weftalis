#!/usr/bin/env node

import { validatePackage, ValidatorExecutionError } from "./index.js";
import type { ValidationIssue, ValidationReport } from "./types.js";

function symbol(status: "passed" | "failed" | "warning"): string {
  if (status === "passed") return "✓";
  if (status === "warning") return "⚠";
  return "✗";
}

function formatIssue(issue: ValidationIssue): string {
  const marker = issue.severity === "error" ? "✗" : "⚠";
  const location = issue.file
    ? ` [${issue.file}${issue.line ? `:${issue.line}` : ""}]`
    : "";
  return `${marker}${location} ${issue.message}`;
}

export function formatReport(report: ValidationReport): string {
  const lines = ["Weftalis Validation", ""];

  for (const check of report.checks) {
    lines.push(`${symbol(check.status)} ${check.label}`);
  }

  if (report.issues.length > 0) {
    lines.push("", "Details:");
    for (const issue of report.issues) {
      lines.push(formatIssue(issue));
    }
  }

  lines.push(
    "",
    `Result: ${report.valid ? "VALID" : "INVALID"}`,
    `Errors: ${report.errorCount}`,
    `Warnings: ${report.warningCount}`,
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Weftalis Validation\n");
    console.error("Please provide a Workflow Package folder or workflow.yaml path.");
    console.error("Example: npm run validate -- ./fixtures/valid-n8n-package");
    process.exitCode = 2;
    return;
  }

  try {
    const report = await validatePackage(inputPath);
    console.log(formatReport(report));
    process.exitCode = report.valid ? 0 : 1;
  } catch (error) {
    const message = error instanceof ValidatorExecutionError
      ? error.message
      : "The Validator encountered an unexpected internal error.";
    console.error("Weftalis Validation\n");
    console.error(`Validator could not run: ${message}`);
    console.error("No Workflow was executed.");
    process.exitCode = 2;
  }
}

await main();
