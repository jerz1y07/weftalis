import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { validateFileReferences } from "../src/path-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturesDirectory = path.resolve(testDirectory, "../fixtures");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function makePackage(): Promise<{ root: string; outsideFile: string }> {
  const temporaryRoot = await mkdtemp(path.join(fixturesDirectory, ".path-test-"));
  temporaryDirectories.push(temporaryRoot);
  const root = path.join(temporaryRoot, "package");
  await mkdir(root);
  const outsideFile = path.join(temporaryRoot, "outside.txt");
  await writeFile(outsideFile, "outside test file", "utf8");
  return { root, outsideFile };
}

describe("safe Package paths", () => {
  it.each([
    "../outside.txt",
    "%2e%2e%2foutside.txt",
    "%252e%252e%252foutside.txt",
    "/absolute.txt",
    "C:/windows.txt",
    "folder\\windows.txt",
  ])("rejects unsafe path %s before accepting a file", async (unsafePath) => {
    const { root } = await makePackage();
    const result = await validateFileReferences(root, [
      { field: "runtime.source_file", path: unsafePath },
    ]);
    expect(result.files).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === "path.unsafe")).toBe(true);
  });

  it("rejects a symlink whose real target is outside the Package", async () => {
    const { root, outsideFile } = await makePackage();
    const link = path.join(root, "linked-source.txt");
    await symlink(outsideFile, link);

    const result = await validateFileReferences(root, [
      { field: "runtime.source_file", path: "linked-source.txt" },
    ]);
    expect(result.files).toHaveLength(0);
    expect(
      result.issues.some((issue) => issue.code === "path.symlink-outside-package"),
    ).toBe(true);
  });

  it("accepts a regular file inside the Package", async () => {
    const { root } = await makePackage();
    await writeFile(path.join(root, "source.json"), "{}", "utf8");
    const result = await validateFileReferences(root, [
      { field: "runtime.source_file", path: "source.json" },
    ]);
    expect(result.issues).toHaveLength(0);
    expect(result.files).toHaveLength(1);
  });

  it("rejects a directory instead of a regular file", async () => {
    const { root } = await makePackage();
    await mkdir(path.join(root, "source-directory"));
    const result = await validateFileReferences(root, [
      { field: "runtime.source_file", path: "source-directory" },
    ]);
    expect(result.files).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === "path.not-file")).toBe(true);
  });
});
