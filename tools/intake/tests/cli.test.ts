import { describe, expect, it } from "vitest";

import { runCli } from "../src/cli.js";

describe("intake CLI", () => {
  it("returns 2 for missing required arguments", async () => {
    let output = "";
    const code = await runCli([], { error: (value) => { output += value; } });
    expect(code).toBe(2);
    expect(output).toContain("--manifest is required");
  });

  it("prints a review-first dry-run summary without candidate contents", async () => {
    let output = "";
    const code = await runCli(["--manifest", "fixture.json", "--dry-run"], {
      repositoryRoot: "/fixture/repository",
      run: async () => ({
        dryRun: true,
        outputRoot: "/fixture/repository/intake-review",
        failedCount: 0,
        processed: [{
          reviewDirectory: null,
          reusedExisting: false,
          record: {
            review_id: "fixture-review",
            moderation: { current_status: "needs_review" },
          },
        }] as never,
      }),
      log: (value) => { output += value; },
    });
    expect(code).toBe(0);
    expect(output).toContain("DRY RUN (no files written)");
    expect(output).toContain("Human review is required");
    expect(output).toContain("No Workflow was executed");
  });

  it("returns 1 when a source could not be retrieved", async () => {
    const code = await runCli(["--manifest", "fixture.json"], {
      repositoryRoot: "/fixture/repository",
      run: async () => ({
        dryRun: false,
        outputRoot: "/fixture/repository/intake-review",
        failedCount: 1,
        processed: [],
      }),
      log: () => undefined,
    });
    expect(code).toBe(1);
  });
});
