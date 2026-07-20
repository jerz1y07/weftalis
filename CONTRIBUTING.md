# Contributing to Weftalis

Thank you for helping improve Weftalis. The project welcomes focused contributions that make Workflow Packages easier to describe, inspect, validate, review, and discover.

## Ways to contribute

You can contribute:

- bug reports and documentation corrections;
- focused feature proposals;
- Workflow Packages for the currently supported platforms, **n8n** and **dify**;
- platform Adapter and Validator improvements;
- Registry Builder improvements; and
- accessibility, design, content, or code improvements for the static website.

Please keep each contribution small enough to review safely. Do not combine unrelated features, broad refactors, and new Workflow Packages in one change.

## Report a bug

Use the Bug Report issue form. Include the affected component, exact reproduction steps, expected behavior, actual behavior, Node.js version, operating system, and redacted logs when useful.

Never put a real password, token, API key, credential, private key, or sensitive Workflow data in an Issue, screenshot, log, test fixture, or commit.

## Suggest a feature

Use the Feature Request issue form. Explain the problem first, then the proposed solution, alternatives, and affected component. A focused problem statement is more useful than a large implementation plan.

Do not use a public feature request to disclose a security vulnerability or real secret. See [SECURITY.md](SECURITY.md).

## Contribute a Workflow Package

Follow [Submitting Workflows](docs/submitting-workflows.md). Start from `packages/_template`, keep the Package folder name identical to the `id` in `workflow.yaml`, include the original platform export, documentation, and safe example input and output, then run all local checks.

Version 0.1 accepts only n8n and dify Workflow Packages. Other platforms need a separately reviewed specification and Adapter change before their Packages can be accepted.

The Validator passing does not prove that a Workflow is absolutely safe, correct, useful, or legally reusable. Secret scanning and capability detection can miss risks or report harmless text. Every submitted Workflow still requires human review under [Reviewing Workflows](docs/reviewing-workflows.md).

## Contribute code

For Adapter, Validator, Registry Builder, or website changes:

1. Read the component README and existing tests.
2. Make one focused, reversible change.
3. Add or update tests for changed behavior.
4. Run the component's type check, tests, and build.
5. Explain behavior changes and safety implications in the Pull Request.

Adapters and Validators must inspect Workflow exports as data. They must not execute nodes, evaluate embedded code, contact workflow platforms, or send Package data to external services.

## Commits and Pull Requests

- Use clear commit messages that describe one logical change.
- Do not commit generated caches, local settings, credentials, or unrelated formatting changes.
- Keep the Pull Request title and description specific.
- Complete the Pull Request checklist and identify the changed component or Package path.
- Describe how the change was tested and any limitation a reviewer should know.
- Respond to review feedback with small follow-up changes when possible.
- Do not treat automated checks as approval. Maintainers decide whether a change is accepted after human review.

The repository does not yet use Dependabot or another automatic dependency-upgrade service. That can be reconsidered after the public repository, ownership, and maintenance policy are established.

## License of contributions

Contributions to Weftalis are provided under the [Apache License 2.0](LICENSE). No Contributor License Agreement (CLA) is required.

## Community expectations

Be respectful, constructive, and patient. Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before participating.
