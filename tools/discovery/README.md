# Weft Place External Discovery

External Discovery finds real public Workflow artifact locations and prepares
them for the existing Intake boundary. It is an evidence collector, not a
Registry Builder, Workflow parser, safety classifier, or publication tool.

```text
public ecosystem
  -> source adapter
  -> normalized candidate
  -> immutable-identity dedupe
  -> Intake submission manifest
  -> existing Intake
```

Discovery never executes or imports a Workflow. It does not write `packages/`,
`admissions/`, `registry/`, `website/`, or `intake-review/`. A candidate is
`Discovered`, not `Listed`, and carries no safety, security, runtime,
compatibility, quality, production-readiness, or recommendation claim.

## v1 source strategy

The architecture is source-agnostic through the `DiscoveryAdapter` interface.
The v1 implementation supplies one GitHub repository-tree adapter because the
current Intake contract accepts exact public GitHub repository, commit, and
artifact-path coordinates.

The configured sources are:

- `github:n8n-official-starter-kit`: exact n8n Workflow exports in the
  [n8n self-hosted AI starter kit](https://github.com/n8n-io/self-hosted-ai-starter-kit);
- `github:n8n-community-workflows`: JSON files under `workflows/` in a
  [public n8n community collection](https://github.com/Zie619/n8n-workflows);
  and
- `github:dify-awesome-workflows`: YAML files under `DSL/` in the
  [Awesome Dify Workflow collection](https://github.com/svcvit/Awesome-Dify-Workflow).

These source declarations identify artifact-shaped files at exact immutable
coordinates. They do not establish original authorship or file-level license
applicability. Repository ownership is recorded only as repository-owner
evidence, and repository-level license evidence always carries a scope
limitation. Missing or ambiguous values remain missing or ambiguous.

The [official n8n template library](https://docs.n8n.io/workflows/templates/)
is a credible future adapter target, but it is not used for the v1 Intake
handoff because the existing Intake tool requires GitHub repository
coordinates pinned to a 40-character commit. No repository provenance is
invented for template-service records.

## CLI

Node.js 20.19.0 or newer is required.

```bash
cd tools/discovery
npm ci --ignore-scripts

# List configured sources without network access.
npm run discover -- --list-sources

# Preview up to 75 observations. Preview is the default and writes no files.
npm run discover -- --limit 75 --dry-run

# Filter by platform or repeat --source for exact source IDs.
npm run discover -- --platform dify --limit 50 --format jsonl --dry-run

# Explicitly persist ignored local evidence and an Intake-ready manifest.
npm run discover -- \
  --limit 75 \
  --format jsonl \
  --write \
  --output-dir ../../discovery-workspace/2026-08-20-smoke
```

`--limit` is an integer from 1 through 100, matching the existing Intake batch
maximum. Multiple sources are sampled in deterministic round-robin order so a
large source cannot consume the entire bound. Final candidates are sorted by
immutable dedupe identity.

Use `GITHUB_TOKEN` or `GH_TOKEN` for optional GitHub API authentication. The
token is used only in the request header and is never included in output or
errors. Without a token, the tool uses GitHub's normal unauthenticated public
API behavior and reports rate limits clearly.

`discovered_at` is one timestamp captured for the whole run. Supply
`--discovered-at <ISO timestamp>` or `SOURCE_DATE_EPOCH` when byte-for-byte
reproducible output is required.

## Local evidence workspace

`--write` accepts only a new `discovery-workspace/<run-name>/` directory inside
the repository. The root workspace is Git-ignored. A run contains:

- `candidates.json` or `candidates.jsonl`;
- `report.json`, containing factual counts, platform/source distributions,
  skip reasons, and source errors;
  and
- `intake-manifest.json`, matching the existing Intake submission schema.

An existing run directory is never overwritten. Output path checks reject
repository escape and symbolic-link traversal.

## Candidate and dedupe model

Each candidate records the source adapter, platform, exact public repository,
repository-owner evidence and its limitation, 40-character commit, exact
case-sensitive artifact path, blob and raw URLs, Git blob identity when
available, artifact format, repository-level license evidence, provenance
references, factual warnings, and discovery timestamp.

The deterministic identity is:

```text
github:<lowercase-owner>/<lowercase-repository>@<commit>:<exact-artifact-path>
```

The path remains case-sensitive. Different paths, commits, or repositories do
not merge. Repeated observations of the same immutable coordinates become one
candidate while preserving all discovery-source references.

## Intake handoff

The generated manifest contains only fields already accepted by
`tools/intake/schemas/submission-manifest.schema.json`: exact repository URL,
artifact path, immutable commit, platform hint, factual name and description,
and a non-author discovery submitter. It deliberately omits an upstream-author
claim and license claim. Existing Intake independently retrieves exact bytes,
checks integrity, parses supported structures, collects deeper license and
static evidence, and decides whether quarantine is required.

Generating the manifest does not run Intake, create a Package, promote an
admission record, or modify the public Registry.
