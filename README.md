# Open Workflow Registry

An open registry for publishing, discovering, inspecting, versioning, and reusing AI workflows.

## The Problem

AI workflows are often shared as scattered code snippets, screenshots, or application-specific exports. This makes them difficult to understand, compare, validate, version, and reuse safely. Open Workflow Registry aims to provide a transparent, portable, and community-driven way to describe and share them.

## Target Users

- Workflow authors who want to publish reusable AI workflows.
- Builders who want to discover and inspect workflows before adopting them.
- Tool developers who need a common package format and validation rules.
- Reviewers and maintainers who care about provenance, safety, and version history.

## v0.1 Scope

The first version will focus on the foundations:

- Define a minimal Workflow Package Specification.
- Provide example workflow packages.
- Build a local validator for package structure and metadata.
- Establish a GitHub-native submission and review process.
- Create a static website prototype for browsing registry entries.

## Explicit Non-Goals

v0.1 will not include:

- Hosted workflow execution.
- User accounts or authentication.
- A database-backed registry.
- Payments or monetization.
- Secret, token, or API key storage.
- Guaranteed compatibility with every AI tool or workflow format.
- A production-ready marketplace or full application.

## Status

Open Workflow Registry is an early experimental project. Its concepts, structure, and specifications may change significantly. It is not ready for production use.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution scope, safety rules, and Pull Request expectations. Workflow authors should follow [Submitting Workflows](docs/submitting-workflows.md), and maintainers should use [Reviewing Workflows](docs/reviewing-workflows.md).

Version 0.1 currently accepts Workflow Packages for n8n and dify only. Every Package must pass automated checks and human review. A passing Validator result is not a guarantee of absolute safety.

## Local validation

All commands use project-local dependencies and the Node.js version recorded in `.nvmrc`. From the repository root, run:

```bash
cd validator
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
cd ../tools/registry-builder
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run verify-registry
cd ../../website
npm ci --ignore-scripts
npm run sync-registry
npm run check-registry
npm run lint
npm run build
```

When a Package changes, run `npm run build-registry` in `tools/registry-builder` before `verify-registry`, then sync the website Registry. See [CI Checks](docs/ci-checks.md) for what each check means and how to fix failures.
