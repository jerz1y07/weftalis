# Package-independent Listing admission

`admissions/package-independent/*.json` is the controlled bridge between
isolated Intake evidence and the public Weft Place Registry. It is not Intake
output and must never be written by `tools/intake/`.

Each JSON file is named `<listing-id>.json` and contains:

- ordinary marketplace metadata;
- either exact repository provenance or honest direct-upload provenance;
- immutable artifact identity and hash evidence;
- references to the deeper Intake or review evidence;
- license, parsing, structure, secret-screening, and malicious-content results;
- explicit static risk signals; and
- optional human-review evidence when an escalation was resolved.

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
invent repository, commit, or upstream fields.

The Builder reads this directory and `packages/` as two inputs to the same
deterministic `registry/registry.json`. A package-independent Listing never
causes a Package to be created and no imported Workflow is executed.
