# JSON Repair Faithful Import Plan

## Decision and boundary

The artifact-level recommendation is **admissible without functional
modification**. No Workflow Package is created by this plan.

The import, if later approved, must wrap the existing upstream Dify Workflow. It
must not redesign the repair process, replace the library, add validation logic,
add a human gate, or otherwise improve the Workflow by inventing new behavior.
The static evidence and open questions are recorded in
[`json-repair-artifact-audit.md`](json-repair-artifact-audit.md).

## Authoritative upstream identity

- Repository: `https://github.com/svcvit/Awesome-Dify-Workflow`
- Pinned commit: `e730ed3627e5fa56fc1668d995b83178b6b1181c`
- Exact path: `DSL/json-repair.yml`
- Exact byte length: `3244`
- SHA-256: `5859d8c833593069cfe781da27d585a24cdbbf5e03a50af56b2ae01045d491ad`
- Git blob SHA-1: `d2d9d3cd13b009b6e57bbe6d39baedc63d6e66ea`
- Upstream attribution: repository publisher, source attribution, and introducing
  commit identity `svcvit`
- Repository license evidence: MIT, copyright 2024 `svcvit`

These values are immutable inputs to a future import review. Changing the commit
or path requires a new artifact-level audit and a new hash.

## Preservation model

A future package should distinguish immutable evidence from the file selected for
runtime import.

```text
<future-package>/
├── workflow.yaml
├── README.md
├── source/
│   ├── upstream/
│   │   └── DSL/
│   │       └── json-repair.yml
│   └── workflow.yml                 # only if sanitization is later required
└── provenance/
    ├── upstream-artifact.json
    └── transformations.json
```

For this candidate, no sanitization is currently required. The future
`runtime.source_file` should therefore point directly to the immutable upstream
copy under `source/upstream/DSL/json-repair.yml`; `source/workflow.yml` should not
be created merely to duplicate or reserialize the YAML.

The immutable copy must be retrieved from the raw GitHub URL at the pinned commit
and written without newline conversion, YAML parsing/reserialization, key
reordering, comment insertion, or formatting. Verification must fail closed if
its size, SHA-256, or Git blob identifier differs from the values above.

## Machine-readable upstream record

The future `provenance/upstream-artifact.json` should contain, at minimum, this
shape:

```json
{
  "record_version": "1.0",
  "repository": "https://github.com/svcvit/Awesome-Dify-Workflow",
  "commit": "e730ed3627e5fa56fc1668d995b83178b6b1181c",
  "path": "DSL/json-repair.yml",
  "raw_url": "https://raw.githubusercontent.com/svcvit/Awesome-Dify-Workflow/e730ed3627e5fa56fc1668d995b83178b6b1181c/DSL/json-repair.yml",
  "byte_length": 3244,
  "sha256": "5859d8c833593069cfe781da27d585a24cdbbf5e03a50af56b2ae01045d491ad",
  "git_blob_sha1": "d2d9d3cd13b009b6e57bbe6d39baedc63d6e66ea",
  "retrieved_from": "github-raw",
  "author_source_identity": "svcvit",
  "license_expression": "MIT"
}
```

The actual record may add retrieval date and evidence URLs. It must not include a
GitHub email address, access token, local temporary path, or claim that GitHub
identity establishes a legal personal identity.

## Sanitized derivative and transformation record

If a later review discovers material that requires an allowed non-functional
sanitization, preserve the immutable file and create a separate derivative at
`source/workflow.yml`. Never overwrite the upstream copy.

`provenance/transformations.json` should be machine-readable and include:

```json
{
  "record_version": "1.0",
  "upstream_sha256": "5859d8c833593069cfe781da27d585a24cdbbf5e03a50af56b2ae01045d491ad",
  "derivative": null,
  "transformations": [],
  "invariants": {
    "node_ids_unchanged": true,
    "node_types_unchanged": true,
    "embedded_code_unchanged": true,
    "edges_unchanged": true,
    "input_output_selectors_unchanged": true
  }
}
```

For the current no-derivative decision, `derivative` remains `null` and the
transformation list remains empty. If a derivative is later necessary,
`derivative` must include its relative path, byte length, and SHA-256, and every
transformation entry must include:

- a stable transformation ID;
- one allowed transformation type;
- a YAML path or exact line target in the upstream file;
- a description of the removed or replaced value without recording a secret;
- the reason;
- the reviewer;
- a declaration that the transformation is non-functional;
- before and after value hashes where safe and useful.

Allowed transformation types are limited to:

1. `remove_secret_or_credential_metadata`;
2. `replace_secret_or_credential_metadata_with_placeholder`;
3. `remove_personal_identifier`;
4. `normalize_weftalis_wrapper_metadata`;
5. `add_documentation_outside_workflow_artifact`.

The fourth and fifth types should normally affect `workflow.yaml`, README, or
provenance files, not the upstream Dify YAML. A YAML parser that merely rewrites
quotes, whitespace, key order, or line endings still creates a derivative and
must never replace the preserved upstream bytes.

## Fidelity invariants

A future import must preserve all of the following:

- application kind `app`, mode `workflow`, name `json-repair`, and DSL version
  `0.1.2`;
- exactly three functional nodes with IDs `1732007415808`, `1732007419308`, and
  `1732007423290`;
- node types `start`, `code`, and `end` and their current order;
- exactly the two current edges and selectors;
- required `llm_string` paragraph input and declared maximum `10000`;
- Code-node language `python3`, complete embedded code, imports, function call,
  and `ensure_ascii=False` argument;
- Code result `result` and final Workflow output `output`;
- empty environment-variable and conversation-variable arrays;
- all feature and UI metadata, including apparently unused values, unless a
  later non-functional change is individually approved and recorded.

The following changes are prohibited because they would create a new or altered
Workflow:

- adding or removing a functional node;
- changing either edge;
- replacing `json_repair` with a different parser or inline implementation;
- pinning a dependency by editing the DSL;
- removing the unused `json` import;
- adding validation, retries, error handling, schemas, prompts, models, network
  calls, persistence, or a human-approval node;
- changing input length, names, types, or output selectors;
- changing repair parameters or returning a parsed object instead of a string.

If safe operation is judged to require any prohibited change, this candidate must
be reclassified as **reference only** rather than adapted under the current
admission rule.

## Planned Weftalis declarations

These are proposed wrapper declarations for a later package review, not current
Registry metadata:

| Area | Planned declaration |
| --- | --- |
| Platform | Dify |
| Upstream minimum | Record the repository-wide statement `0.13.0` as upstream guidance only; do not claim verified compatibility. |
| Runtime source | Exact immutable upstream YAML unless an approved sanitization becomes necessary. |
| Models | None. |
| Services | None used by the graph. |
| Tools | Dify Code node and external Python package `json_repair` with version unresolved. |
| Network access | `false` for Workflow execution as statically represented. Dependency acquisition is separate deployment administration. |
| Filesystem read/write | `false` based on the graph and embedded code. |
| Credential access | `false`. |
| Email/social publishing | `false`. |
| Code execution | `true`. |
| Human review | `required: false`, because the upstream graph has no human gate. Documentation should recommend post-output review without claiming enforcement. |
| Testing | `untested`; static audit and hash verification are not runtime tests. |
| Provisional risk | `medium`, due to untrusted-input code execution, heuristic semantic changes, an unpinned dependency, and unverified platform compatibility, despite no declared network or credential access. |

The current specification has one `author` field but no structured fields for
upstream author, package maintainer, source commit, or transformation record. A
future package must not solve that limitation by changing the specification in
this task. Human review should select a truthful `author` value while the README
and provenance records separately identify `svcvit` as upstream source and
Weftalis contributors as wrapper-document maintainers.

## Required documentation around the unchanged file

A later package README and provenance document should state:

- exact upstream repository, path, pinned commit, introducing commit, author
  evidence, SHA-256, Git blob identifier, and MIT evidence;
- `json_repair` is required but is not bundled or version-pinned by the Workflow;
- operators must independently choose, install, verify, and license-review the
  dependency in their Dify code-execution environment;
- no model or provider credential is needed by the graph;
- embedded Python executes on untrusted input;
- repair is heuristic and must not be treated as factual, schema, or semantic
  verification;
- the Workflow has no enforced human-review step;
- Dify may retain execution data according to deployment settings;
- Runtime untested, import untested, and compatibility unverified;
- no screenshot, repository asset, library source, dataset, font, prompt, or
  unrelated repository file is bundled.

## Human approval gates before package creation

1. Accept or reject the file-level MIT evidence, including the absence of a
   per-file SPDX header and separate contribution statement.
2. Decide how the future single `author` metadata field will distinguish upstream
   creation from Weftalis wrapper maintenance.
3. Select and separately review an exact `json_repair` package version if runtime
   testing is later authorized. Do not silently turn that selection into an
   upstream Workflow claim.
4. Confirm whether the selected Dify environment permits and contains that exact
   dependency without changing the Workflow.
5. Confirm Dify import compatibility with DSL `0.1.2` in a separately authorized
   runtime-test phase.
6. Recompute the preserved file's SHA-256 and fail if it differs.
7. If any sanitization is proposed, review the derivative hash and every
   transformation record before package validation.

## Remaining uncertainties

- Legal identity and complete originality cannot be proven from GitHub metadata
  alone.
- Repository-level MIT evidence is strong but not a per-file legal attestation.
- The exact `json_repair` runtime version, integrity hash, vulnerability state,
  and deployment method are unresolved.
- Current Dify import behavior, sandbox package availability, input-limit
  enforcement, and retention behavior are untested.
- The Workflow's heuristic output may not preserve intended meaning.
- The future package-author representation needs a human decision under the
  current specification.

