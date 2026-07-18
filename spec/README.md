# Weftalis Workflow Package Specification v0.1

This directory contains version 0.1 of the Weftalis Workflow Package Specification.

## Contents

- `workflow-package-spec.md` is the human-readable specification.
- `workflow.schema.json` is the JSON Schema Draft 2020-12 structural definition.
- `examples/valid-basic-workflow.yaml` is a low-risk n8n metadata example without human review.
- `examples/valid-human-reviewed-workflow.yaml` is a dify writing workflow metadata example with a required Human Approval checkpoint.
- `examples/invalid-missing-license.yaml` is intentionally invalid because the required top-level `license` field is absent. JSON Schema validation should report the missing field.
- `examples/invalid-undeclared-permission.yaml` is intentionally semantically invalid. Its description, dependencies, inputs, and outputs show that it sends email, but `permissions.email_send` is falsely set to `false`.

## Using the examples

The YAML files demonstrate metadata documents. They do not include executable workflow exports, credentials, or live service connections.

The two valid examples are expected to satisfy `workflow.schema.json`. The invalid missing-license example is expected to fail structural Schema validation.

The undeclared-permission example demonstrates a limit of JSON Schema: its fields have valid types and required fields, so it is expected to pass structural Schema validation. It is still semantically invalid. A future Validator should inspect the original platform export and compare detected actions with the metadata. For this example, an email-send node or equivalent action should require `permissions.email_send: true`, so the semantic Validator should reject the package with a clear mismatch without executing the workflow.

`categories`, `tags`, `testing`, and `repository` are optional. Omitting `testing` makes no testing claim. The package interface, dependencies, permissions, human-review declaration, safety declaration, runtime information, license, and README reference remain required.

No Validator is implemented in Phase 3.
