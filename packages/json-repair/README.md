# json-repair

## Package status

| Label | Status |
| --- | --- |
| Package type | Imported upstream workflow |
| Schema validation | Pending until checked |
| Static review | Completed without execution |
| Runtime status | Untested |
| Implementation status | Upstream artifact preserved |
| Risk level | Medium |
| Code execution | Yes |
| Network access | None declared |
| Credentials | None declared |
| External writes | None declared |
| Human review | Recommended |
| External dependency | `json_repair`, upstream version unpinned |
| Dify compatibility | Unverified |

This Weftalis Workflow Package wraps an existing Dify Workflow; it does not redesign or functionally modify it. The authoritative runtime source is the exact upstream artifact at [`source/upstream/DSL/json-repair.yml`](source/upstream/DSL/json-repair.yml). Its verified SHA-256 is `5859d8c833593069cfe781da27d585a24cdbbf5e03a50af56b2ae01045d491ad`.

Schema validation in the table is deliberately marked pending: Weftalis package validation is a static wrapper check and is not Dify import/schema validation. No Dify installation or runtime was used for this package.

## What the upstream Workflow does

The Workflow accepts one required string input named `llm_string`, passes it to a Python Code node that calls `json_repair.repair_json(..., ensure_ascii=False)`, and returns the resulting string as `output`. It contains three nodes (Start, Code, and End) and two edges.

The package does not promise that repaired text matches the author's intended data, conforms to a schema, or preserves meaning. Compare the output with the original input before relying on it, especially when it may control consequential actions. This recommendation is documentation only: the upstream graph has no enforced human-review checkpoint.

## Provenance and authorship

- Upstream repository and publisher: [`svcvit/Awesome-Dify-Workflow`](https://github.com/svcvit/Awesome-Dify-Workflow), GitHub identity `svcvit`.
- Exact upstream path: `DSL/json-repair.yml`.
- Pinned commit: [`e730ed3627e5fa56fc1668d995b83178b6b1181c`](https://github.com/svcvit/Awesome-Dify-Workflow/commit/e730ed3627e5fa56fc1668d995b83178b6b1181c).
- Original introduction commit: [`13fc5335b625a2bf8dc29002a10e03a356ffce75`](https://github.com/svcvit/Awesome-Dify-Workflow/commit/13fc5335b625a2bf8dc29002a10e03a356ffce75), dated 2024-11-20.
- Retrieval date: 2026-07-21.
- Upstream author attribution: `svcvit`, supported by the repository publisher identity, pinned README attribution, and introducing commit identity. This does not establish a legal personal identity or prove sole authorship of every exported DSL element.
- Weftalis package maintainer: Weftalis maintainers.

The unchanged upstream Workflow artifact is treated as MIT-licensed based on the repository-level [`LICENSE`](https://github.com/svcvit/Awesome-Dify-Workflow/blob/e730ed3627e5fa56fc1668d995b83178b6b1181c/LICENSE), which states `Copyright (c) 2024 svcvit`. The exact upstream notice is included as [`LICENSE.upstream`](LICENSE.upstream). There is no per-file SPDX header or separate signed contribution statement; the repository-level evidence is not independent legal clearance.

The wrapper metadata and documentation in `workflow.yaml`, this README, and `provenance/*.json` are authored for Weftalis and are separate from the unchanged upstream artifact. They are covered by the Weftalis repository's Apache-2.0 license. No upstream screenshot, library source, dataset, font, prompt, or unrelated repository asset is included.

Machine-readable evidence is in [`provenance/upstream-artifact.json`](provenance/upstream-artifact.json) and [`provenance/transformations.json`](provenance/transformations.json).

## Dependencies, permissions, and risks

The Workflow executes embedded Python against supplied text. It imports the external `json_repair` dependency, but the upstream artifact does not pin a version and this package does not add one. The dependency is not bundled, installed, or executed here. Its exact runtime version, integrity, vulnerability state, license for the operator-selected version, availability in Dify, and deployment method remain unresolved.

Static inspection finds no model node, network node, credential reference, environment variable, filesystem operation, or external-write node. These are declarations about the preserved graph and embedded code, not a safety certification. Dify may retain inputs, outputs, or execution logs according to deployment settings outside this artifact.

Heuristic repair may change, invent, omit, or misassociate values. Malformed or adversarial input may produce errors, excessive processing, or unexpected results. Dify sandbox isolation, resource limits, dependency availability, and the declared 10,000-character input limit were not runtime tested.

## Compatibility and testing limits

The metadata value `runtime.minimum_version: 0.13.0` records only the upstream repository-wide guidance at the pinned revision. It is not a verified compatibility claim for this artifact.

No claim is made that this Workflow is safe, runtime tested, ready to run, compatible with current Dify Cloud, compatible with any particular self-hosted Dify version, or production ready. Dify import behavior, current schema compatibility, sandbox package availability, execution behavior, and output correctness are all untested. Human review is required before any separately authorized runtime evaluation.
