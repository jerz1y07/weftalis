import parseSpdxExpression from "spdx-expression-parse";

import type { ValidationIssue } from "./types.js";

export function validateLicense(expression: string): ValidationIssue[] {
  try {
    const parsed = parseSpdxExpression(expression);
    const serialized = JSON.stringify(parsed);

    if (/LicenseRef-|DocumentRef-/i.test(expression) || /LicenseRef-/i.test(serialized)) {
      throw new Error("custom LicenseRef expressions are not supported by v0.1");
    }

    return [];
  } catch {
    return [
      {
        severity: "error",
        code: "license.invalid-spdx",
        message: `license "${expression}" is not a supported SPDX license expression.`,
        file: "workflow.yaml",
      },
    ];
  }
}
