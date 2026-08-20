# Weft Place Intake Threat Model

## Scope and security objective

Phase 12A intake receives untrusted source claims and workflow artifacts and turns them into local evidence for human review. Its security objective is limited: retrieve an exact public GitHub file without executing it, preserve the reviewed bytes, surface conservative static signals, contain output, and prevent automated publication.

The pipeline is not a sandbox, malware detector, runtime validator, compatibility test, legal review, or safety certification.

## Trust boundaries

The main boundaries are:

1. **Submission manifest to local intake.** Every manifest field is attacker-controlled until parsing, secret screening, and schema validation succeed.
2. **Local intake to GitHub.** Repository metadata, ref resolution, Contents API responses, license responses, raw bytes, headers, and status codes are external input even when received from an allowed GitHub host.
3. **Artifact bytes to static parsers.** YAML, JSON, node configuration, embedded code text, identifiers, and dependency declarations are untrusted data.
4. **Generated metadata to human review.** Automated findings are incomplete and may be wrong. Reviewers must not treat them as trusted conclusions.
5. **Review output to Listing, Packages, and the public Registry.** Intake output must remain isolated. Listing decisions, optional Package generation, and Registry materialization require separate controlled processes that do not exist in Phase 12A.

An optional `GITHUB_TOKEN` is local process configuration. It is sent only as an HTTP authorization header by the GitHub client and must never be placed in a manifest, artifact, error, review record, or repository file.

## Untrusted manifests and workflow artifacts

Manifests accept JSON, YAML, or YML only. YAML parsing requires unique keys and limits alias expansion; the resulting value must satisfy strict schemas with no additional properties. Repository paths reject absolute paths, `..` segments, backslashes, queries, and fragments. A batch is limited to 100 submissions.

Artifacts remain byte strings until static parsing. The system never imports them as modules, launches them in Dify or n8n, evaluates embedded expressions or code, installs declared plugins, invokes shells, supplies credentials, or contacts destinations named inside the workflow.

Malformed or unsupported content is not repaired or executed. Malformed hinted Dify YAML or n8n JSON is quarantined; unsupported content remains unknown or needing review.

## URL and GitHub resolution risks

User-controlled repository URLs can be used for server-side request forgery, credential leakage, ambiguous provenance, or fetching a different resource than a reviewer expects. Intake restricts submitted URLs to HTTPS on `github.com`, with no credentials, custom port, query, fragment, or extra path components. Owner and repository names are restricted before downstream URLs are constructed.

API requests are built from fixed `api.github.com` endpoints. Raw artifact URLs are constructed from the validated repository identity, a full resolved commit, and an encoded repository path; the initial raw URL must use HTTPS on `raw.githubusercontent.com`.

The repository metadata returned by GitHub can canonicalize owner and repository casing. Intake requires the metadata to report both `private: false` and `visibility: public`; an optional privileged token does not bypass that policy. The exact artifact path returned by GitHub must match the submitted path byte-for-byte in case, and the object must be a regular file.

These checks reduce arbitrary-host and confused-path risks, but they do not prove repository ownership, submitter identity, or the truth of provenance claims.

## Redirects and host validation

The client uses manual redirect handling with a maximum of five redirects. Every destination must remain HTTPS, contain no embedded credentials or custom port, parse cleanly, and use the approved GitHub host set. A fetch implementation that reports an already-followed redirect is rejected because intermediate hops could not be validated.

Authorization headers are generated again for each hop and are attached only for `api.github.com`. A redirect to another approved host therefore does not receive the token. Redirect handling never accepts submitter-supplied download URLs.

## Path traversal and output containment

The submission schema requires a repository-relative artifact path and rejects common traversal forms. Path segments are individually URL-encoded for retrieval. GitHub must return the same exact case-sensitive path before bytes are accepted.

For local output, the review root and each relevant existing path component are checked with `lstat` and rejected if symbolic. Lexical containment and resolved `realpath` containment are checked before reads and writes, after directory creation, and before final files and rename. Output cannot be the repository root or overlap Packages, Registry, website, or Git metadata. Any output inside the repository is restricted to the default Git-ignored `intake-review` directory.

Review data is first written to a new staging directory using restrictive permissions and then atomically renamed. Existing review directories are verified and reused rather than overwritten. These measures reduce traversal, symlink, partial-write, and overwrite risks; they do not make arbitrary files outside a correctly selected output root safe to trust.

## Artifact-size and timeout limits

Each GitHub request uses a 30-second abort timeout. Artifact size is capped at 10 MiB using both GitHub's reported file size and the retrieved byte length, raw response bodies stop streaming when the cap is crossed, and a reported-size mismatch fails retrieval.

Residual limits remain:

- the timeout applies per request, so a submission can cause several sequential requests;
- JSON metadata and license response bodies do not have an explicit byte cap before parsing;
- base64 API content is decoded before the final byte-length check;
- CPU and memory costs of JSON/YAML parsing and static traversal are not enforced by a separate worker or process limit; and
- duplicate indexing reads no more than 10,000 review directories and ignores individual review records over 5 MiB.

The limits reduce accidental or simple resource exhaustion but are not a complete denial-of-service defense.

## Secret-like values and redaction

The manifest is scanned before schema parsing. If a potential secret-like value is found, intake rejects the manifest and does not copy it into review output.

Retrieved artifacts are preserved byte-for-byte for human review, so a secret present upstream can also be present in the isolated local artifact copy. Static review metadata records only a heuristic kind, line number, and redacted preview, and the completed metadata object receives a final secret-like-value redaction pass before serialization. Credential references record key or type information without copying credential IDs, names, or values. Potential secret-like artifact values cause quarantine.

Secret scanning uses a small pattern set. It can miss obfuscated, split, encoded, novel, or platform-specific secrets and can flag harmless examples. Local review output must therefore be handled as sensitive untrusted material even when the scan reports no finding.

## Malformed YAML and JSON

JSON is parsed with the standard JSON parser. YAML requires unique keys and limits alias expansion. Invalid UTF-8, parser errors, non-object roots, ambiguous platform shapes, and unsupported Dify/n8n structures do not become executable objects.

Invalid UTF-8 or malformed hinted Dify YAML or n8n JSON receives schema-compatible `parsing_status: needs_review` but recommends and ends in `quarantined`. Only the concise `invalid_utf8`, `malformed_yaml`, or `malformed_json` category is recorded, semantic analysis is not attempted, and unavailable risk items remain `unknown`. Unsupported or unrecognized shapes remain `needs_review`.

## Static capability signals

The parser looks for evidence of:

- embedded code or command-capable nodes;
- shell-related APIs or node types;
- HTTP, model-provider, database, messaging, email, publishing, and other network capability;
- credential keys or credential types;
- environment-variable references;
- filesystem, database, messaging, publishing, HTTP, and other external writes;
- webhooks and triggers;
- plugins, custom nodes, and imported dependencies; and
- personal or hard-coded identifiers.

Signals are intentionally conservative. A detected signal means relevant text or structure exists, not that the path is reachable or the effect will occur. `not_detected` means only that the implemented heuristics found nothing in a recognized structure.

## Duplicate and provenance risks

Artifact duplicates are detected by SHA-256. Source duplicates are detected by normalized repository, exact path, and pinned commit. These checks can identify identical bytes or repeated source coordinates in the local review set, but they cannot identify semantically equivalent rewrites, copied artifacts with small changes, mirrors, renamed repositories, rewritten history, or reviews outside the local queue.

A unique hash does not prove originality. A repository URL, submitter authorship claim, upstream author field, or license claim does not prove identity, ownership, consent, or legal permission. Repository-level license evidence may not apply to the file, and an SPDX header may be incorrect or unauthorized. Ambiguous or conflicting provenance and license evidence requires human escalation; ordinary Listing may proceed without universal human review only when the separate admission layer records sufficient evidence and no escalation signal exists.

## Limitations of static analysis

Static analysis cannot reliably determine:

- which nodes or branches are reachable;
- runtime expressions, generated code, or dynamic destinations;
- behavior hidden in plugins, custom nodes, models, external services, or dependencies;
- permissions and isolation supplied by a deployment;
- actual credentials, data classification, or data flow;
- side effects produced only under particular inputs;
- compatibility with a specific Dify or n8n version; or
- whether upstream content changes outside the pinned commit.

Obfuscation and unsupported node types can evade heuristics. Findings can also be false positives. When a candidate triggers human escalation, the reviewer must inspect the preserved bytes and their context rather than relying on the automated findings alone.

## What passing intake does not prove

A candidate that reaches `needs_review` has not been shown to be:

- safe or free of malicious behavior;
- compatible with any Dify or n8n release;
- executable or correctly configured;
- free of secrets or personal identifiers;
- complete, useful, reliable, or production ready;
- properly licensed or submitted by an authorized author; or
- appropriate for a Weftalis Workflow Package or the public Registry.

The recorded runtime status remains `untested`, and compatibility remains `unverified`.

## Current Intake publication invariant

Automatic publication from the current Phase 12A Intake tool must remain impossible. The moderation schema fixes `automatic_publication` to `false`; the CLI ends at `needs_review` or `quarantined`; human decisions are required for its `approved` and `rejected` statuses; and output containment blocks overlap with Packages, Registry, website, and Git metadata.

Even human approval of an Intake record is evidence for a later decision, not Listing or publication. Phase 12A contains no Listing decision, conversion, Registry update, push, release, or deployment path. Future work must preserve explicit, auditable boundaries between Intake, Listing decisions, optional Package generation and validation, Registry materialization, and deployment. Those boundaries prevent an untrusted submission from directly mutating public data; they do not make human approval or Package creation universal prerequisites for ordinary Listing.
