import type {
  CheckStatus,
  ValidationCheck,
  ValidationIssue,
  ValidationReport,
} from "./types.js";

export class ValidatorExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidatorExecutionError";
  }
}

export class ReportBuilder {
  readonly checks: ValidationCheck[] = [];
  readonly issues: ValidationIssue[] = [];

  addCheck(status: CheckStatus, label: string): void {
    this.checks.push({ status, label });
  }

  addIssue(issue: ValidationIssue): void {
    this.issues.push(issue);
  }

  addIssues(issues: ValidationIssue[]): void {
    this.issues.push(...issues);
  }

  build(packageRoot: string, manifestPath: string): ValidationReport {
    const errorCount = this.issues.filter(
      (issue) => issue.severity === "error",
    ).length;
    const warningCount = this.issues.filter(
      (issue) => issue.severity === "warning",
    ).length;

    return {
      packageRoot,
      manifestPath,
      valid: errorCount === 0,
      checks: this.checks,
      issues: this.issues,
      errorCount,
      warningCount,
    };
  }
}
