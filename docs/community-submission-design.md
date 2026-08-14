# Weft Place Community Submission Design

## Status and intent

This document describes the intended future community-facing flow around the existing Phase 12A local intake records and schemas. The public submission service, direct-upload path, identity system, moderation UI, Listing decision flow, and optional record-to-Package conversion do not exist in Phase 12A.

The design keeps the current safety boundary: a community submission is an untrusted claim that enters Intake. It is not a Workflow Package, automatic Listing, trust claim, or instruction to run a workflow. Human review is an escalation mechanism rather than a universal prerequisite for ordinary Listing.

## Current repository-backed contract

Each submission must provide:

- `record_version: "1.0"`;
- `repository_url`, identifying exactly one public GitHub repository;
- `artifact_path`, identifying the exact case-sensitive file within that repository;
- `workflow_name`;
- `description`; and
- `submitter.name_or_handle` plus `submitter.claims_authorship`.

The repository URL and exact artifact path are both required. The system must not guess a repository, scan for a likely workflow, accept an arbitrary download URL, or silently select among multiple files.

A submitter may provide one optional ref selector:

- `branch`;
- `tag`; or
- a full 40-character `commit`.

At most one ref selector is allowed. If none is supplied, intake uses the repository's reported default branch. `platform_hint` may be `dify`, `n8n`, or `unknown`; it is a hint for review and malformed-input reporting, not a claim that bypasses parser detection.

Optional context includes a submission ID, upstream author or organization, license claim, and notes. Extra fields are rejected by the current schema.

This contract describes the existing GitHub-backed Phase 12A path only. It must not be treated as the only possible source model or as a GitHub account requirement for ordinary users.

## Future direct-upload contract

The long-term product must also accept direct-upload Workflow artifacts. It must never invent a repository, commit, or upstream source for an upload. A future direct-upload record should support:

- `source_type: direct_upload`;
- submitter;
- upload timestamp;
- original artifact hash;
- declared author; and
- declared license.

Direct uploads must always enter an isolated Intake or quarantine boundary and must never directly mutate `packages/`, `registry/`, or `website/`. People should be able to discover, obtain, and submit Workflows, and view submission status, without needing a GitHub account.

## Authorship and license claims

`claims_authorship` is required by the current Phase 12A schema as an explicit boolean so the submitter must state whether they claim to be an author. A handle is not verified identity, and either boolean value remains only a claim.

The optional `upstream_author_or_organization` and `license_claim` fields provide review context. They are not trusted provenance or legal evidence. Automated Intake separately records repository-level GitHub license evidence and scans the first 100 artifact lines for SPDX identifiers. Ambiguous or conflicting applicability requires human escalation; an automated result alone must not be represented as legal clearance.

No form wording, checkbox, repository location, or automated license result should be represented as proof of ownership, consent, or legal clearance.

## Immutable source resolution

After schema validation, the submission system should pass the record to the existing intake boundary:

1. normalize and validate the public GitHub repository URL;
2. inspect the repository identity and default branch;
3. resolve the requested branch, tag, commit, or default branch to a full commit SHA;
4. require an exact match when the submitter supplied a commit;
5. retrieve the exact case-sensitive artifact path at that commit;
6. record the requested ref and whether it was mutable; and
7. preserve the pinned commit and exact original bytes for review.

All later checks and reviewer decisions must refer to the pinned commit and fingerprinted bytes, not to the current state of a mutable branch or tag.

## Automated checks

The existing local intake performs the following non-executing checks:

- manifest secret-like-value screening and strict schema validation;
- GitHub URL normalization and public source resolution;
- exact ref-to-commit resolution;
- exact path, regular-file, size, and reported-size checks;
- SHA-256 and required Git blob integrity fingerprints, with missing or mismatched GitHub identifiers quarantined;
- unchanged-byte preservation outside Package and Registry locations;
- Dify and n8n shape detection and static parsing;
- node, dependency, code, shell, network, credential, external-write, trigger, plugin, custom-node, identifier, and secret-like-value signals;
- repository-level and file-level license evidence collection;
- artifact-hash and pinned-source duplicate detection; and
- validation of the generated review record.

The system must describe these as evidence collection. It must not describe them as execution, sandboxing, malware clearance, compatibility certification, legal approval, or production testing.

## Moderation statuses

The current moderation schema defines:

- `submitted`: the manifest was accepted for local intake;
- `resolving`: the GitHub source is being resolved;
- `fetched`: exact bytes were retrieved and fingerprinted;
- `parsed`: supported static parsing completed;
- `needs_review`: automated intake completed without an automatic quarantine condition;
- `quarantined`: resolution, integrity, secret-like-value, or other explicit conservative concerns require isolation and investigation;
- `approved`: a human reviewer made and recorded an approval decision; and
- `rejected`: a human reviewer made and recorded a rejection decision.

Phase 12A automatically records progress and finishes at `needs_review` or `quarantined`. It does not automatically produce `approved`. The schemas require `approved` and `rejected` decisions to include reviewer identity, review time, and rationale.

## Human review escalation

Human review is required when Intake finds ambiguity or elevated risk, including:

- ambiguous source, submitter, authorship, or direct-upload provenance;
- ambiguous or conflicting license applicability;
- possible secrets or credentials;
- suspicious code or shell execution;
- filesystem writes;
- destructive actions or external publishing;
- high-risk network behavior or data transmission;
- substantial source transformation;
- reports or complaints;
- higher trust or compatibility claims; and
- Featured or curated placement.

Reviewers must account for false positives, false negatives, unsupported nodes, indirect behavior, and changes in Dify or n8n semantics. A human decision cannot be based solely on the absence of automated findings. Human review must not become the default scaling bottleneck for ordinary Listings that meet minimum admission eligibility without an escalation signal.

Ordinary Listing requires a real artifact, traceable repository or valid direct-upload provenance, recorded provenance, no clear blocking license issue, a parseable and structurally plausible artifact, and no obvious secret leak, malicious content, or other high-confidence quarantine signal. Independent runtime testing by Weft Place is not mandatory.

## Approval, rejection, and quarantine

**Approval** records that a named human reviewer accepts the Intake evidence at the stated scope. Approval does not create a Package, automatically List a Workflow, execute it, or certify safety, compatibility, quality, or production readiness.

**Rejection** records a named human reviewer's rationale and stops the candidate from moving forward through this review path. The local evidence should remain available for audit according to the project's retention policy; Phase 12A does not implement deletion or retention automation.

**Quarantine** isolates a candidate that could not be resolved safely or requires special investigation. Current automatic reasons include source-resolution failure, private or non-public repository visibility, missing or mismatched Git blob integrity evidence, invalid UTF-8 or malformed hinted Dify YAML/n8n JSON, and potential secret-like artifact values. Quarantine is not approval or rejection. A human must investigate before any later decision, and no quarantined candidate may become Listed or cross the Package boundary.

The future community-facing layer must not conceal warnings, silently downgrade quarantine, or let a submitter set moderation fields.

## Duplicate handling

The review record separately reports:

- identical artifact bytes by SHA-256; and
- identical source coordinates by normalized repository, exact path, and pinned commit.

A duplicate match should point reviewers to the matching review IDs. It should not automatically merge authorship or license claims, inherit approval, delete either submission, or publish the artifact. A reviewer may reject a redundant submission, retain it as additional provenance evidence, or investigate conflicting claims.

Hash and source matching do not detect all forks, mirrors, renamed files, or semantically equivalent variants.

## Listing and optional Package boundaries

A future Listing decision must be separate from Intake storage. `Listed` means only that Weft Place included the Workflow with a traceable source and sufficient minimum admission evidence. It does not imply safety, runtime testing, compatibility, production readiness, quality, human review, or recommendation.

Listing does not require a local `packages/` Workflow Package. If a later decision creates a Package, it must be implemented as a separate, explicit operation. That later process would need to:

- select the exact pinned and fingerprinted bytes;
- re-check provenance and license decisions;
- create Package metadata and source layout deliberately;
- run the separate Package and Validator checks required at that time; and
- produce a reviewable change before any Registry publication.

The Intake record is evidence for those possible decisions, not a Package template that can be copied blindly. Package creation should be limited primarily to Weft Place-maintained, legally redistributable, Adapter, curated, or compatibility-supported artifacts. Adapter creation is optional. Phase 12A implements none of these Listing, conversion, or publication steps.

## Prohibited shortcuts

There must be no path for an untrusted submission to directly mutate public Registry data or website output. A future submission interface may accept an unverified handle as a claim; ambiguous identity or provenance must trigger human escalation.

The submission system must never execute a submitted workflow, node, embedded script, shell command, plugin, custom node, model call, webhook, credential operation, network request declared by the workflow, or external write. Its own narrowly scoped GitHub retrieval requests are source-resolution operations, not workflow execution.

For the current Phase 12A schema, `automatic_publication` remains `false`. Intake, Listing decisions, optional Package generation, Package validation, Registry materialization, and deployment remain separate boundaries. Ordinary Listing does not require every one of those steps or a universal human approval gate.
