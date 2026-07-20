# Weftalis

The open registry for reusable and verifiable workflows.

Weftalis is an open-source registry for publishing, inspecting, validating, versioning, and reusing workflows across platforms.

## The Problem

AI workflows are often shared as scattered code snippets, screenshots, or application-specific exports. This makes them difficult to understand, compare, validate, version, and reuse safely. Weftalis aims to provide a transparent, portable, and community-driven way to describe and share them.

## Target Users

- Workflow authors who want to publish reusable AI workflows.
- Builders who want to discover and inspect workflows before adopting them.
- Tool developers who need a common package format and validation rules.
- Reviewers and maintainers who care about provenance, safety, and version history.

## v0.1 Release Candidate

The v0.1.0 candidate includes the project foundations:

- Weftalis Workflow Package Specification v0.1 and its JSON Schema.
- A local static Validator for Package structure, metadata, referenced files, selected secret patterns, and limited platform evidence.
- A Registry Builder and synchronized generated Registry data.
- Two example Workflow Packages, one for n8n and one for Dify.
- A GitHub-native contribution, review, and CI process.
- A read-only static website for browsing Registry entries.

## Explicit Non-Goals

v0.1 will not include:

- Hosted workflow execution.
- User accounts or authentication.
- A database-backed registry.
- Payments or monetization.
- Secret, token, or API key storage.
- Guaranteed compatibility with every AI tool or workflow format.
- A production-ready marketplace or full application.

## Status and Release

Weftalis is a public, early experimental open-source project. The repository and [GitHub Pages website](https://jerz1y07.github.io/weftalis/) are available for inspection and testing, but the project is not a production-ready marketplace or execution platform.

Version `v0.1.0` is currently a release candidate awaiting maintainer review. No `v0.1.0` Git tag or GitHub Release has been created. See the [changelog](CHANGELOG.md), [draft release notes](docs/releases/v0.1.0.md), and [release checklist](docs/releases/v0.1.0-checklist.md).

## Validation Scope and Limitations

The Validator checks the manifest structure, SPDX expression syntax, referenced local paths and files, several common secret patterns, basic n8n and Dify export shapes, and a limited set of statically detectable capabilities. Registry Builder accepts only Packages that pass those current rules.

These checks do **not** prove that a Workflow is safe, truthful, useful, legally reusable, compatible with a runtime version, or executable. They cannot detect every secret, unknown node, indirect data transfer, malicious instruction, obfuscated behavior, license problem, or mismatch between metadata and runtime behavior. A `valid` Registry status is not an endorsement or security certification.

Version 0.1 accepts only n8n and Dify Packages. Human review of source files, permissions, data flows, external services, licenses, examples, and intended behavior remains required before acceptance and before reuse.

## Architecture

Workflow Packages are parsed by the Validator, normalized by Registry Builder into committed Registry JSON, synchronized into the website, and compiled into a static GitHub Pages export. No component in that path executes a Workflow. See the [v0.1 architecture overview](docs/architecture.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution scope, safety rules, and Pull Request expectations. Workflow authors should follow [Submitting Workflows](docs/submitting-workflows.md), and maintainers should use [Reviewing Workflows](docs/reviewing-workflows.md).

Brand usage is documented in [BRAND.md](BRAND.md).

Version 0.1 currently accepts Workflow Packages for n8n and dify only. Every Package must pass automated checks and human review. A passing Validator result is not a guarantee of absolute safety.

## License

Weftalis is available under the [Apache License 2.0](LICENSE).

## Installation and Local Use

Use Node.js `24.18.0`, recorded in `.nvmrc`. The commands below install exactly the locked dependencies and disable dependency lifecycle scripts.

### Validator

```bash
cd validator
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run validate -- ../packages/human-reviewed-writing-pipeline
npm run validate -- ../packages/multi-source-research-assistant
cd ..
```

The Validator reads Package files as data and never executes Workflow nodes.

### Registry Builder

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

`build-registry` writes `registry/registry.json` and `registry/rejected.json`. Review both files before committing them.

### Website

```bash
cd website
npm ci --ignore-scripts
npm run sync-registry
npm run check-registry
npm run lint
npm run build
WEFTALIS_BASE_PATH=/weftalis npm run build
cd ..
```

The first build uses normal local paths. The second reproduces the GitHub Pages `/weftalis` base path. See [CI Checks](docs/ci-checks.md) for what each check means and how to fix failures.
