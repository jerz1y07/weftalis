# Submitting a Weftalis Workflow Package

This guide explains how to prepare an n8n or dify Workflow Package for Weftalis and propose it through a Pull Request. The Registry never executes the submitted Workflow.

## Before you begin

Install the Node.js version recorded in the repository's `.nvmrc`. The commands below use only project-local dependencies from each `package-lock.json`; they do not assume that Validator, TypeScript, or other tools are installed globally.

Never place a real password, token, API key, credential, private key, or sensitive user data in the Package, examples, logs, commits, Issues, or Pull Request.

## 1. Fork the repository

After the project has a public GitHub repository, use GitHub's **Fork** button to create your own copy. Clone your fork using the URL GitHub shows for your copy, then enter the cloned project directory:

```bash
git clone <your-fork-url>
cd <your-cloned-folder>
```

Do not copy the placeholder text literally; replace `<your-fork-url>` with your fork URL.

## 2. Copy the Package template

From the repository root:

```bash
cp -R packages/_template packages/<workflow-id>
```

Replace `<workflow-id>` with a lowercase ID made from letters, numbers, and hyphens, for example `document-review-helper`.

## 3. Match the folder name and Workflow ID

Open `packages/<workflow-id>/workflow.yaml` and set `id` to exactly the same value as the folder name. The Registry Builder rejects mismatches.

## 4. Complete `workflow.yaml`

Fill every required field. Declare the real platform, dependencies, inputs, outputs, permissions, data handling, risk level, and Human Review checkpoints. Version 0.1 supports only `n8n` and `dify`.

Use an SPDX license identifier or expression such as `MIT`, `Apache-2.0`, or `MIT OR Apache-2.0`. Only submit content that you have the right to share under the declared license.

## 5. Add the original Workflow source

Export the Workflow from n8n or dify and save it under the Package's `source/` directory. Update `runtime.source_file` to its relative path.

Inspect the export as text before committing it. Remove credential values, tokens, environment-specific private data, and unnecessary execution history. Do not run an untrusted Workflow to test it.

## 6. Add documentation and safe examples

Replace the template README with setup, inputs, outputs, permissions, external services, Human Review points, and known limitations. Add representative example input and output with fictional, non-sensitive data. Make the `files` paths in `workflow.yaml` match the actual files.

## 7. Run the Validator locally

From the repository root:

```bash
cd validator
npm ci --ignore-scripts
npm run validate -- ../packages/<workflow-id>
npm run typecheck
npm test
npm run build
cd ..
```

Fix every error. Read every warning and explain any warning that cannot be removed. A passing result still requires human review.

## 8. Build and verify the Registry

From the repository root:

```bash
cd tools/registry-builder
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run build-registry
npm run verify-registry
cd ../..
```

Review changes to `registry/registry.json` and `registry/rejected.json`. Your Package should appear in the main Registry, not in the rejected list. `verify-registry` ignores only generated timestamps; every other difference must be committed.

## 9. Sync the website Registry

From the repository root:

```bash
cd website
npm ci --ignore-scripts
npm run sync-registry
npm run check-registry
npm run lint
npm run build
cd ..
```

Commit the generated `website/generated/registry.json`. Do not edit it by hand and do not replace it with mock data.

## 10. Create a Pull Request

Review the changed files, create focused commits, push them to your fork, and open a Pull Request against the main repository after it becomes public. Complete the Pull Request template, including external services, high-risk capabilities, Human Review, tests, and areas needing special reviewer attention.

Automated CI will repeat the Validator, Builder, Registry verification, website checks, and build. Maintainers will then perform the manual checks in [Reviewing Workflows](reviewing-workflows.md). Passing CI is necessary, but it does not guarantee acceptance or safety.
