# Weftalis Continuous Integration Checks

The Weftalis GitHub Actions configuration in `.github/workflows/ci.yml` is prepared to run on Pull Requests and pushes to either common default-branch name, `main` or `master`, after the repository is uploaded. It is not a deployment workflow and does not execute submitted Workflows.

## 1. Checkout and Node.js

CI checks out repository files with read-only repository permission and without keeping Git credentials. It installs the Node.js version recorded in `.nvmrc`.

If this step fails, check the Actions service message, `.nvmrc`, and whether the selected Node.js version is available. Do not solve it by adding a token or broadening workflow permissions.

## 2. Validator

CI runs:

```bash
cd validator
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
```

- `npm ci --ignore-scripts` installs exactly the locked dependencies without dependency lifecycle scripts. If it fails, update `package.json` and `package-lock.json` together in a separate, reviewed dependency change.
- `typecheck` finds TypeScript type errors. Fix the reported source location; do not disable type safety broadly.
- `test` checks Validator behavior and safety fixtures. Reproduce the named failing test locally and make a focused fix.
- `build` confirms that distributable TypeScript output can be created. Fix compiler errors before resubmitting.

## 3. Registry Builder

CI runs the same safe install, type check, tests, and build in `tools/registry-builder`, followed by:

```bash
npm run verify-registry
```

The verifier rebuilds Registry data in a temporary directory and compares it with committed `registry/registry.json` and `registry/rejected.json`. It ignores only root-level `generated_at` and each accepted Workflow's `validation.checked_at`. Workflow counts, IDs, canonical order, metadata, permissions, safety declarations, validation state, and rejected Packages must otherwise match.

If verification fails, read the reported JSON paths, then run `npm run build-registry` in the Builder directory. Review and commit both root Registry files. The verifier does not print changed field values and never executes a Workflow.

## 4. Website data and build

CI runs:

```bash
cd website
npm ci --ignore-scripts
npm run sync-registry
npm run check-registry
npm run lint
npm run build
```

- `sync-registry` copies the root Registry into `website/generated/registry.json` after structural checks.
- `check-registry` validates the generated website data, count, unique IDs, required fields, and validation status.
- `lint` checks website code quality.
- `build` confirms that the static site can be generated from real Registry data.

CI then uses a quiet Git diff check on `website/generated/registry.json`. If it fails, run the sync and check commands locally and commit the updated generated file. Do not edit it by hand or restore mock data.

## Safety limits

CI uses `pull_request`, never `pull_request_target`; sets `contents: read`; uses no repository Secret; does not commit, push, deploy, comment, or upload an Artifact; and does not connect to n8n, dify, or external business APIs. Package source files and Code nodes are parsed only as data and are never run.

Passing CI cannot prove that a Workflow is safe or truthful. Human review remains mandatory under [Reviewing Workflows](reviewing-workflows.md).

Automatic dependency-update services such as Dependabot are intentionally deferred until the repository is public and its ownership and maintenance policy are established.
