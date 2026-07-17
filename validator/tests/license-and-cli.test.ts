import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validateLicense } from "../src/license-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const validatorDirectory = path.resolve(testDirectory, "..");

function runCli(input?: string) {
  const argumentsList = ["--import", "tsx", "src/cli.ts"];
  if (input) argumentsList.push(input);
  return spawnSync(process.execPath, argumentsList, {
    cwd: validatorDirectory,
    encoding: "utf8",
  });
}

describe("SPDX license validation", () => {
  it.each(["MIT", "Apache-2.0", "GPL-3.0-only", "MIT OR Apache-2.0"])(
    "accepts %s",
    (expression) => {
      expect(validateLicense(expression)).toHaveLength(0);
    },
  );

  it.each(["Free to use", "Open source", "LicenseRef-Custom"])(
    "rejects %s",
    (expression) => {
      expect(validateLicense(expression)).toHaveLength(1);
    },
  );
});

describe("CLI exit codes and safe output", () => {
  it("returns 0 for a valid Package", () => {
    const result = runCli("./fixtures/valid-n8n-package");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Result: VALID");
  });

  it("returns 0 when validation passes with a Warning", () => {
    const result = runCli("./fixtures/warning-unknown-node");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Unknown n8n node");
    expect(result.stdout).toContain("Warnings: 1");
    expect(result.stdout).toContain("Result: VALID");
  });

  it("returns 1 for an invalid Package", () => {
    const result = runCli("./fixtures/invalid-email-permission");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("email_send");
    expect(result.stdout).toContain("Result: INVALID");
  });

  it("returns 2 for missing arguments", () => {
    const result = runCli();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Please provide");
    expect(result.stderr).not.toContain("at ");
  });

  it("redacts the full fake secret in CLI output", () => {
    const fakeSecret = "sk-FAKEONLYFORVALIDATOR1234567890XY";
    const result = runCli("./fixtures/invalid-secret");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("sk-…XY");
    expect(result.stdout).not.toContain(fakeSecret);
  });
});
