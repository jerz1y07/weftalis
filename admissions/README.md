# Package-independent Listing admission

`admissions/package-independent/*.json` is the controlled bridge between
isolated Intake evidence and the public Weft Place Registry. It is not Intake
output and must never be written by `tools/intake/`.

Core Phase 3B adds an explicit promotion command in the admission/Registry
tooling. It reads a controlled promotion request and, for repository-backed
sources, the referenced existing Intake `review-record.json`. It does not
contact the upstream source, reparse artifact bytes, execute a Workflow, or
write Registry, Package, website, or Intake data.

Each JSON file is named `<listing-id>.json` and contains:

- ordinary marketplace metadata;
- either exact repository provenance or honest direct-upload provenance;
- immutable artifact identity and hash evidence;
- references to the deeper Intake or review evidence;
- license, parsing, structure, secret-screening, and malicious-content results;
- explicit static risk signals; and
- optional human-review evidence when an escalation was resolved.

The record also preserves Intake creation and retrieval timestamps. When a
transformed artifact exists, it records a separate transformed hash, owner,
license, and transformation evidence; those fields never replace the original
upstream or upload hash.

The input does not contain a `Listed` switch. Registry Builder computes one of
three outcomes:

- `Listed` when the minimum evidence is present and no escalation signal exists;
- `Needs Review` for ambiguity, elevated capability, substantial transformation,
  reports, or higher-trust claims without review evidence; or
- `Quarantined` for source/integrity/parse failures, clear license blockers,
  possible secret values, or suspected malicious content.

Human approval is not required for the first outcome. When approval resolves a
`Needs Review` escalation, the record must preserve the reviewer, review time,
rationale, and evidence reference. Approval cannot override missing evidence
references, an id/file mismatch, or a quarantine condition.

The current repository-backed lane follows the existing GitHub Intake boundary.
It requires one normalized public GitHub repository URL, the matching exact blob
URL, a full 40-character commit, repository-relative artifact path, matching
blob or raw acquisition URL, and SHA-256. Direct uploads use
`source_type: direct_upload`, submitter, upload
timestamp, original hash, declared author, and declared license. They must not
invent repository, commit, or upstream fields. Missing direct-upload fields
remain `null`: missing author or license evidence requires review, while a
missing original artifact hash or failed integrity evidence requires
quarantine.

## Promote completed Intake evidence

Run from `tools/registry-builder`:

```bash
npm run admission:promote -- \
  <promotion-request.json> \
  --output <repository-root>/admissions/package-independent/<listing-id>.json
```

Preview is the default. `--dry-run` makes that choice explicit and `--write`
is required to create the admission record. The output filename must exactly
match the requested Listing id. An identical rerun reuses byte-identical
output; a divergent collision is refused rather than overwritten.

The promotion request carries ordinary Listing metadata and explicit
assessments for license evidence, malicious-content evidence, transformation,
and user reports. It also requires stable evidence references: controlled
repository-relative files or HTTPS references that Registry Builder can check
without depending on the Git-ignored local Intake queue. Repository requests
point to an existing repository-relative Intake review record for local
promotion. Direct-upload requests carry their isolated Intake evidence without
repository fields. Missing or contradictory evidence is preserved and
escalated; the promoter never defaults it to a clean result.

The preview prints the identity, source type, provenance completeness, license
result, important signals, proposed Core 3A state, missing evidence, and output
path. Exit code `0` means preview or write succeeded, `1` means a safe write or
collision failure, and `2` means the request or recorded evidence was invalid.
The proposed state is computed by the same admission decision function used by
Registry Builder, so the promoter is not a second Builder.

The Builder reads this directory and `packages/` as two inputs to the same
deterministic `registry/registry.json`. A package-independent Listing never
causes a Package to be created and no imported Workflow is executed.
