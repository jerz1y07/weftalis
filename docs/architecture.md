# Weft Place Registry Architecture

Weft Place is a file-based, read-only Registry. Its tools inspect Workflow
Packages and controlled admission evidence but never execute imported Workflows.

```text
packages/<workflow-id>/ ---> Package Validator ---------+
                                                       |
isolated Intake evidence                               v
        |                                      Registry Builder
        v                                              |
controlled admission record ---------------------------+
  (no Package required)                                |
                                    +------------------+------------------+
                                    v                                     v
                         registry/registry.json               registry/rejected.json
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

- **Workflow Packages** contain `workflow.yaml`, a README, an original n8n or Dify export, and optional safe examples.
- **Workflow Package Specification v0.1** defines the metadata structure and JSON Schema. It does not define execution semantics.
- **Validator** parses local files as untrusted data and reports structural, path, license, secret-pattern, platform-shape, permission, and safety-declaration findings.
- **Registry Builder** discovers Packages, calls the Validator, and emits normalized accepted and rejected Registry JSON. It does not duplicate the Validator rules.
- **Package-independent admission records** are controlled evidence projections outside Intake. Registry Builder derives `Listed`, `Needs Review`, or `Quarantined`; records cannot self-publish. Clean ordinary Listings do not require a Package or universal human approval.
- **Website sync** copies accepted Registry metadata into a committed generated file and checks the fields required by the website.
- **Static website** imports generated Registry data at build time and exports HTML. It has no server, database, API, upload, authentication, or execution path.
- **GitHub Actions** repeats read-only validation and build checks. A separate least-privilege workflow deploys only `website/out` to GitHub Pages.

## Reproducibility boundary

Package and Registry content is reproducible from tracked files and locked dependencies. Registry builds intentionally include `generated_at` and `validation.checked_at` timestamps; the verifier ignores only those documented fields and compares everything else, including order.

The website build consumes the committed generated Registry. `WEFTALIS_BASE_PATH=/weftalis` produces the GitHub Pages project-site paths; an unset base path produces the normal local static build.

## Trust boundary

The automated path checks only what can be inferred from static files and a limited set of known patterns. It does not contact n8n or Dify, test external services, execute nodes, prove metadata claims, establish license ownership, or certify safety. Human review is an escalation mechanism for ambiguous or risky admission evidence and remains necessary before reuse; it is not a universal prerequisite for an ordinary public Listing.
