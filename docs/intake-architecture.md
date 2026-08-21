# Weft Place Intake Architecture

## Purpose and boundaries

The Phase 12A intake pipeline is a local, review-first process for collecting evidence about public upstream workflow artifacts. It accepts a batch submission manifest, resolves each claimed source to exact GitHub bytes, performs conservative static inspection, and writes a local review record. This is the behavior of the current GitHub-backed engineering tool, not the complete Weft Place source or admission model.

Intake treats submissions and artifacts as untrusted data. It does not execute workflows, install their dependencies, test them against Dify or n8n, create a Workflow Package, update the public Registry, or publish anything. Passing this Intake pipeline means only that evidence was recorded. It does not imply safety, compatibility, runtime testing, human review, Listing, or any other trust claim.

## Submission-to-review lifecycle

1. The CLI loads a JSON, YAML, or YML batch manifest.
2. The manifest and each submission are validated against the intake schemas. A batch contains 1–100 submissions.
3. Potential secret-like values in the manifest cause the whole manifest to be rejected before it is retained in review output.
4. For each submission, intake normalizes the GitHub repository identity, inspects the public repository, and resolves the requested ref.
5. A branch, tag, or default branch is resolved to a full 40-character commit SHA. An explicitly submitted commit must resolve exactly.
6. The exact, case-sensitive artifact path is retrieved at that immutable commit.
7. The original bytes are fingerprinted, checked against GitHub's required reported blob identifier, and preserved for review unless the run is a dry run. A missing or mismatched identifier fails integrity verification.
8. Repository-level and file-level license evidence is collected separately.
9. The artifact is parsed as supported Dify or n8n data when its shape is recognized. Static risk, dependency, credential-reference, identifier, and secret-like-value signals are extracted without execution.
10. The new record is compared with existing local review records and earlier entries in the same batch.
11. Intake writes a quarantined record when safe resolution fails, Git blob integrity is missing or mismatched, supported JSON/YAML is malformed, or potential secret-like values are detected. Other successfully processed candidates stop at `needs_review`.
12. The current Phase 12A tool stops for a human decision because it has no Listing decision or publication capability. That implementation limit is not a universal human-review prerequisite for ordinary Listing.

A source failure is recorded conservatively and does not stop later submissions in the same validated batch.

## Schema model

The active Phase 12A community submission schema is `tools/intake/schemas/community-submission.schema.json`. It requires:

- record version `1.0`;
- a public GitHub repository URL;
- an exact repository-relative artifact path;
- workflow name and description; and
- submitter name or handle plus an authorship-claim boolean.

A submission may select at most one of `branch`, `tag`, or a full commit SHA. It may also provide a Dify, n8n, or unknown platform hint, an upstream author or organization, a license claim, notes, and a submission ID. Unknown fields are rejected.

These GitHub-only requirements describe the current schema, not the long-term product contract. A future source model must also support direct uploads without inventing repository or commit provenance. Direct-upload records should carry a distinct source type, submitter, upload timestamp, original artifact hash, declared author, and declared license, and must enter an isolated Intake or quarantine boundary.

The batch manifest, resolved artifact, static audit, moderation status, and combined review record each have a versioned JSON Schema. The review record links these models and adds duplicate status, warnings, and uncertainties. Schema loading is limited to files ending in `.schema.json`, and generated review records are validated before they are written.

## GitHub source resolution

Only URLs shaped as `https://github.com/OWNER/REPOSITORY` are accepted. The URL may have a trailing slash or `.git` suffix, but may not contain credentials, a port, query, fragment, or extra path component. The repository owner and name are checked before the client constructs GitHub API URLs.

The client uses GitHub repository metadata to require `private: false` and `visibility: public`, record the canonical owner, repository name, normalized URL, and default branch, and reject private, internal, or otherwise unconfirmed visibility even when an optional token can read it. It then uses the GitHub commits API to resolve the selected branch, tag, commit, or default branch.

The artifact is requested through the GitHub Contents API at the resolved commit. It must be a regular file, and GitHub's returned path must exactly match the submitted case-sensitive path. If inline base64 content is unavailable, the client constructs an immutable `raw.githubusercontent.com` URL from the validated repository identity, pinned commit, and encoded path.

Each GitHub request has a 30-second timeout and uses manual redirects. Every hop is limited to HTTPS on the approved GitHub host set, rejects embedded credentials and malformed destinations, and counts toward a maximum of five redirects. Authorization is generated per hop and is sent only to `api.github.com`, so it is not forwarded when the host changes. Artifact bytes are limited to 10 MiB by both reported size and retrieved byte length, raw responses are stopped while streaming once the limit is crossed, and a reported-size mismatch fails retrieval.

## Immutable commit pinning

Branches, tags, and default branches are mutable inputs. Intake records the requested ref and whether it was mutable, but all artifact and license retrieval is performed against the resolved full commit SHA. This creates a reviewable link between the submitter's request and the immutable source inspected by intake.

Pinning does not prove repository ownership or prevent upstream history from later becoming unavailable. It identifies the exact commit used for this review.

## Original-byte preservation and fingerprints

For a non-dry-run review, intake writes the fetched `Uint8Array` unchanged beneath:

`intake-review/reviews/<review-id>/artifact/upstream/<artifact-path>`

The stored bytes are read back and compared with the fetched SHA-256 before the staged review directory is atomically renamed into place. On an identical rerun, intake verifies the existing record and stored artifact rather than overwriting it.

The fingerprint records:

- SHA-256 of the fetched bytes;
- byte size and line count;
- GitHub's required reported Git blob identifier;
- a locally calculated Git blob SHA-1 using Git's `blob <length>\0<bytes>` representation;
- whether the reported and calculated Git blob identifiers match; and
- the stored artifact SHA-256 and whether it matches the fetched bytes.

A missing or mismatched Git blob identifier marks source resolution as failed and quarantines the record. SHA-256 remains independently recorded and is also the basis for artifact duplicate detection.

## Dify and n8n parsing

Parsing is static and shape-based:

- n8n candidates must be JSON objects with `nodes` and `connections`;
- Dify candidates must be YAML-compatible objects with `workflow.graph.nodes`.

The parser records the detected platform, workflow/application type, schema indicators, node identities and types, node and edge counts, dependencies, warnings, and uncertainties. A platform hint selects the expected data parser but cannot make malformed input valid. Invalid UTF-8 or malformed hinted n8n JSON or Dify YAML stops before semantic analysis, records only a concise parse-error category, and recommends `quarantined`; its schema-compatible `parsing_status` remains `needs_review`. Unsupported or ambiguous shapes remain `needs_review`.

No node, embedded code, plugin, model, platform, or external service is run.

## Static risk extraction

The Dify and n8n parsers conservatively extract evidence for:

- code and shell execution;
- model or LLM use and provider references;
- credential and environment-variable references;
- HTTP or other network capability;
- filesystem, database, messaging, publishing, and other external writes;
- webhooks and triggers;
- plugins and custom nodes;
- possible human approval nodes; and
- personal or hard-coded identifiers.

Risk summaries report `detected`, `not_detected`, or `unknown` with bounded
evidence and a caution. A heuristic secret scan records only a redacted preview
and line number in review metadata. Potential secret-like artifact values remain
isolated by the Intake quarantine boundary, and potential secret-like manifest
values cause manifest rejection. This Intake boundary does not turn a heuristic
match into confirmed leakage or a final Admission quarantine decision;
downstream Admission keeps heuristic findings reviewable and reserves hard
quarantine for confirmed leakage.

These signals describe static evidence, not reachability, runtime behavior, data flow, safety, or completeness.

## Duplicate detection

Intake compares each candidate with up to 10,000 readable existing local review records and with earlier candidates processed in the same batch. It records two independent forms of duplication:

- artifact duplicates: identical SHA-256 values;
- source duplicates: the same normalized repository, exact artifact path, and pinned commit.

Matches are recorded as review IDs and surfaced as warnings. Duplicate detection does not automatically approve, reject, merge, or publish a candidate.

## License evidence

License information remains evidence, not authorization. Intake keeps three concepts separate:

- the submitter's optional license claim;
- repository-level evidence returned by GitHub's License API at the pinned commit; and
- file-level SPDX identifiers found by scanning the first 100 artifact lines.

Repository evidence may be found, missing, ambiguous, or unavailable. File evidence may be found, missing, ambiguous, or not scanned. Neither result proves authorship, ownership, applicability to the artifact, or legal permission. Ambiguous or conflicting provenance or license evidence requires human escalation; ordinary Listing does not require universal human review when minimum admission evidence has no clear blocking issue.

## Review queue output

The default queue is the Git-ignored `intake-review` directory. Each review directory contains:

- `submission.json`;
- `resolved-upstream-artifact.json`;
- `static-audit-result.json`;
- `moderation-status.json`;
- `review-record.json`; and
- the unchanged upstream artifact when retrieval succeeded.

Writes use a staging directory and restrictive file modes before an atomic rename. Output containment rejects symbolic links at the review root and every relevant reviews, staging, artifact, existing-record, and destination path. It checks lexical and resolved containment before reads and writes, after directory creation, and again before final writes and rename. Output cannot use the repository root or overlap Packages, Registry, website, or Git metadata. If output is placed inside the repository, only the default `intake-review` location is allowed.

Moderation history records the automated stages. The current CLI can end at `needs_review` or `quarantined`; `approved` and `rejected` are reserved by the current schema for a human reviewer and require a recorded human decision. The moderation schema fixes `automatic_publication` to `false`. These Phase 12A statuses must not collapse the separate product states `Discovered`, `Listed`, `Static reviewed`, `Runtime tested`, `Compatibility verified`, `Human reviewed`, `Featured`, and `Quarantined` or `Removed`.

## Dry-run behavior

`--dry-run` performs manifest validation, GitHub resolution and retrieval, fingerprinting, license evidence collection, static parsing, duplicate checks, moderation recommendation, and generated-record schema validation. It may therefore make the same read-only GitHub requests as a normal run.

Dry-run does not create an output directory or write submission, artifact, audit, moderation, or review files. Its in-memory record leaves the stored artifact path and stored-byte hashes unset.

## Separation from Listing, Packages, and Registry publication

Intake output is evidence for moderation, not a Workflow Package and not a Registry Entry. The output guard rejects paths that overlap `packages/`, `registry/`, `website/`, or `.git/`, and the CLI has no Package-generation or publication step.

A public Listed Workflow does not require a local Workflow Package. Listing eligibility is a separate decision based on traceable source and sufficient minimum admission evidence; it does not require independent runtime testing or universal human approval. Human review is reserved for escalation signals and higher trust or curated claims.

If a later decision creates a Package, conversion must be a separate, explicit process with its own validation, provenance, and redistribution decisions. `packages/` should primarily contain Weft Place-maintained, legally redistributable, Adapter, curated, or compatibility-supported artifacts. Adapter creation is optional. Neither Listing nor Package boundaries are crossed by Phase 12A Intake.
