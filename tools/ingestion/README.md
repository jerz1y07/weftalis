# Weft Place Batch Ingestion

Batch Ingestion coordinates the existing Discovery, Intake, Admission Promoter,
and Registry Builder. It does not discover new sources, parse Workflow behavior,
scan secrets, decide admission independently, create Packages, execute imported
Workflows, or publish production Registry data.

```text
Discovery run / intake-manifest
  -> deterministic candidate order
  -> isolated existing Intake per candidate
  -> deterministic promotion request derived from recorded evidence
  -> existing Admission Promoter
  -> staged admission record
  -> optional existing Registry Builder preview
```

## CLI

Node.js 20.19.0 or newer is required.

```bash
cd tools/ingestion
npm ci --ignore-scripts

# Preview is the default. Temporary evidence is removed after the run.
npm run ingestion:batch -- ../../discovery-workspace/<run-name> --limit 25

# Write only to the ignored ingestion workspace.
npm run ingestion:batch -- \
  ../../discovery-workspace/<run-name> \
  --write \
  --limit 25 \
  --concurrency 4

# Continue the same deterministic run. Completed candidates are not repeated.
npm run ingestion:batch -- \
  ../../discovery-workspace/<run-name> \
  --write \
  --resume
```

The input may be a Discovery run directory or its `intake-manifest.json`. A
standalone manifest must remain beside its recorded `report.json`; a sibling
candidate file is consumed when present. `--limit` accepts 1–100 and
`--concurrency` accepts 1–8. Use `--json` for a machine-readable stdout summary,
or read `summary.json` from a written run. `--no-registry-preview` disables the
temporary Builder preview.

The deterministic run id is based on the normalized input hash. `--run-id` may
provide a stable lowercase label. An existing run is never overwritten without
`--resume`. Resume verifies the input hash, reads completed `result.json` files,
and retries only failed or interrupted candidates. Intake and Admission writes
retain their existing byte-collision checks.

Within one process, identical read-only GitHub API requests are deduplicated in
memory before the existing Intake client consumes them. This reduces repeated
repository, commit, and license lookups across a batch. Failed responses are not
cached. Artifact retrieval and Git blob integrity checks remain in Intake, and
the cache never persists credentials or response data.

## Workspace

Live output is restricted to:

```text
ingestion-workspace/<run-id>/
  state.json
  summary.json
  summary.txt
  candidates/<candidate-id>/
    candidate.json
    intake-manifest.json
    intake/reviews/<review-id>/...
    promotion-request.json
    admission/<candidate-id>.json
    result.json
    promotion-attempts/ and admission-attempts/ (only after a failed-source retry)
  registry-preview/
    admissions/
    output/registry/registry.json
    output/registry/rejected.json
  registry-preview-attempts/attempt-<n>/ (only when a retry changes preview evidence)
```

Each candidate has only the operational state `pending`, `processing`,
`completed`, or `failed`. A completed orchestration candidate may still have a
downstream `Listed`, `Needs Review`, or `Quarantined` admission state.
Retryable source failures such as GitHub rate limiting, network timeout, or a
temporary API/download failure remain operationally `failed` and resumable.
They do not produce a promotion request, staged admission record, or admission
state from incomplete evidence. The summary reports `retryable_failed` and
`promotion_eligible` separately from downstream admission counts.

## Evidence derivation

The promotion request uses the immutable Discovery identity, original Intake
submission, exact repository/path/commit, Intake artifact hash, parse and secret
evidence, and recorded license evidence. Repository ownership is preserved only
as repository-owner evidence and never promoted to original creator.
Repository-level license evidence keeps its scope limitation.

Missing malicious-content assessment and user-report evidence remain
`not_assessed` and `unknown`. Missing license or author evidence remains unclear
or null through the existing admission contract. The orchestrator does not
manufacture clean evidence to increase the Listed count and does not add a
score or a new trust taxonomy.

For repository-backed candidates, clearly identified repository-level license
evidence remains usable evidence when there is no contradictory file-level
evidence or explicit blocker. Its repository scope stays factual; a missing
file-level identifier is not rewritten as artifact-level proof. An unknown
original creator, an unperformed malicious-content assessment, and unknown user
reports are not negative evidence by themselves. Heuristic secret-like findings
remain distinct from confirmed secret leakage.

Registry preview copies controlled production admission records and new staged
records into the ignored workspace, then calls the existing Registry Builder
with that temporary admission directory. Existing Package-backed Listings and
package-independent repository or direct-upload Listings can therefore coexist
without modifying `registry/registry.json`.
