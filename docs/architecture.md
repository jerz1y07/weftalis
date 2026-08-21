# Weft Place Registry Architecture

Weft Place is a file-based, read-only Registry. Its tools inspect Workflow
Packages and controlled admission evidence but never execute imported Workflows.

```text
public Workflow ecosystems
  -> External Discovery (preview or ignored local evidence)
  -> normalized candidate + Intake handoff
  -> Batch Ingestion Orchestrator (preview or ignored local workspace)
  -> isolated existing Intake per candidate
  -> automatically derived controlled promotion request
  -> Admission Promoter (preview by default)
  -> controlled admission record (no Package required) ----+
                                                            |
packages/<workflow-id>/ -> Package Validator ---------------+
                                                            |
                                                            v
                                                     Registry Builder
                                                            |
                                      +---------------------+--------------------+
                                      v                                          v
                           registry/registry.json                    registry/rejected.json
                                      |
                                      v
                                Website sync
                                      |
                                      v
                       website/generated/registry.json
                                      |
                                      v
                           Next.js static export
```

## Components

- **External Discovery** uses source adapters to resolve public artifacts to factual, normalized candidates with deterministic immutable identities. Its default mode is preview-only; optional live evidence stays in the Git-ignored `discovery-workspace/`. It neither parses Workflow behavior nor writes Intake, Package, admission, Registry, or website data.
- **Batch Ingestion Orchestrator** deterministically orders a Discovery handoff, gives each candidate an isolated existing Intake directory, derives the minimum controlled promotion request from recorded evidence, calls the existing Admission Promoter, and optionally calls the existing Registry Builder with a temporary admission directory. Live evidence stays in Git-ignored `ingestion-workspace/`; individual candidate failures are recorded without publishing or stopping unrelated candidates.
- **Workflow Packages** contain `workflow.yaml`, a README, an original n8n or Dify export, and optional safe examples.
- **Workflow Package Specification v0.1** defines the metadata structure and JSON Schema. It does not define execution semantics.
- **Validator** parses local files as untrusted data and reports structural, path, license, secret-pattern, platform-shape, permission, and safety-declaration findings.
- **Registry Builder** discovers Packages, calls the Validator, and emits normalized accepted and rejected Registry JSON. It does not duplicate the Validator rules.
- **Package-independent admission records** are controlled evidence projections outside Intake. Registry Builder derives `Listed`, `Needs Review`, or `Quarantined`; records cannot self-publish. Clean ordinary Listings do not require a Package or universal human approval.
- **Admission Promoter** reads completed Intake evidence plus explicit promotion assessments and deterministically projects one package-independent admission record. It reuses Registry Builder's admission decision semantics, defaults to preview, refuses divergent identity collisions, and never writes the public Registry.
- **Website sync** copies accepted Registry metadata into a committed generated file and checks the fields required by the website.
- **Static website** imports generated Registry data at build time and exports HTML. It has no server, database, API, upload, authentication, or execution path.
- **GitHub Actions** repeats read-only validation and build checks. A separate least-privilege workflow deploys only `website/out` to GitHub Pages.

## Reproducibility boundary

Package and Registry content is reproducible from tracked files and locked dependencies. Promotion output has no generated timestamp: it preserves recorded Intake timestamps, so identical evidence produces identical bytes. Batch Ingestion supplies the recorded Discovery event time to Intake, preserves deterministic candidate identity, and reuses completed evidence on resume. Registry builds intentionally include `generated_at` and `validation.checked_at` timestamps; the verifier ignores only those documented fields and compares everything else, including order. A batch preview uses the recorded Discovery time and never writes the production Registry.

The website build consumes the committed generated Registry. `WEFTALIS_BASE_PATH=/weftalis` produces the GitHub Pages project-site paths; an unset base path produces the normal local static build.

## Trust boundary

The automated path checks only what can be inferred from static files and a limited set of known patterns. Promotion consumes recorded evidence instead of fetching or parsing upstream content again. Neither promotion nor Registry generation contacts n8n or Dify, tests external services, executes nodes, proves metadata claims, establishes license ownership, or certifies safety. Human review is an escalation mechanism for ambiguous or risky admission evidence and remains necessary before reuse; it is not a universal prerequisite for an ordinary public Listing.

Discovery is even narrower: a candidate means only that a configured public source exposed an artifact-shaped file at recorded source coordinates. Repository ownership is not artifact authorship, repository-level license evidence may not apply to a file, and Discovery makes no safety, runtime, compatibility, quality, production-readiness, recommendation, or Listing claim. Existing Intake remains responsible for retrieval integrity, parsing, static evidence, and quarantine decisions.
