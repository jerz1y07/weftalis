# Registry Builder v0.1

Registry Builder scans local Workflow Packages and creates stable, reviewable JSON data for Open Workflow Registry. It never executes a Workflow.

## Relationship to the Validator

Registry Builder imports the structured `validatePackage` function exported by `validator/src/index.ts`. The Validator remains the single source of truth for Package structure, referenced files, licenses, secret scanning, platform-source parsing, permissions, and safety checks. Registry Builder does not copy those validation rules and does not parse human-facing CLI text.

After the Validator accepts a Package, Registry Builder reads its manifest only to select and normalize public index fields. It does not copy the complete platform export into Registry data.

## Run locally

Node.js 20.19.0 or newer is required. Install dependencies once, then build the Registry:

```bash
cd tools/registry-builder
npm install
npm run build-registry
```

Development checks are available as `npm run typecheck`, `npm test`, and `npm run build`.

## Add a Package

1. Copy `packages/_template` to `packages/<workflow-id>`.
2. Make the folder name exactly match the lowercase `id` in `workflow.yaml`.
3. Complete the manifest, README, source export, and examples.
4. Keep every credential value and secret out of the Package.
5. Run the Validator directly, then run Registry Builder.

## Discovery and ignore rules

Only direct child directories of `packages/` that contain a regular `workflow.yaml` file are candidates. Discovery is sorted by directory name.

Registry Builder ignores:

- directories whose names begin with `_`, including `_template`;
- hidden directories whose names begin with `.`;
- `node_modules`, `tmp`, and `temp` directories;
- ordinary directories without `workflow.yaml`; and
- files directly inside `packages/`.

The tool does not recursively discover nested Packages.

## Output files

`registry/registry.json` contains only valid, normalized Workflow entries. It is intended to become a stable read-only data source for the website and future GitHub-native submission checks.

`registry/rejected.json` contains invalid candidates, repair-oriented errors, and warnings. Rejection does not prevent valid Packages from being written to the main Registry. A valid empty rejected file is always generated when nothing is rejected.

Both files use two-space formatted JSON, stable field order, and alphabetical ordering. A single build timestamp is used for `generated_at` and each entry's `validation.checked_at`.

Optional display fields follow one normalization rule: missing `categories` and `tags` become empty arrays, and missing `testing` becomes `null`. Optional properties inside a present `testing` object are omitted. Validation error and warning collections are always arrays. Optional issue locations use `null`.

Paths are repository-relative POSIX paths. Registry Builder rejects any attempt to normalize a path outside the repository.

## Duplicate and identity rules

- A manifest `id` must exactly match its Package folder name.
- IDs are also compared case-insensitively.
- Every Package involved in an exact duplicate or case-only conflict is rejected.
- Conflict errors list the repository-relative Package locations.

## Exit codes

- `0`: both JSON files were generated, even if one or more Packages were rejected.
- `1`: Registry generation or output writing failed.
- `2`: the tool could not start, determine its repository root, or load the Validator.

## Current limitations

- Discovery is local and limited to one Package version per top-level folder.
- Static validation cannot prove that metadata is truthful, a Workflow is useful, or an export will run correctly.
- Secret scanning and platform capability detection are heuristic and require human review.
- Registry Builder does not connect to GitHub, external services, workflow platforms, or the website.
- It does not execute, publish, install, or deploy any Workflow.
