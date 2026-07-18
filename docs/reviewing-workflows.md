# Reviewing Weftalis Workflow Packages

This guide is a manual checklist for maintainers. Automated checks help locate known problems, but reviewers remain responsible for understanding the submitted files. Never execute an untrusted Workflow during review.

## Purpose and provenance

- Read the Package README, `workflow.yaml`, original platform export, and examples.
- Confirm that the actual Workflow purpose matches its name, description, inputs, outputs, tags, and examples.
- Look for misleading claims, hidden behavior, irrelevant nodes, obfuscated content, or instructions that could manipulate users or reviewers.
- Confirm that the contributor owns the content or has the right to submit and license it.

## License

- Confirm that `license` is a valid-looking SPDX expression and is compatible with the submitted content.
- Check notices or upstream license requirements when the Workflow was adapted from another source.
- Remember that automated SPDX parsing cannot prove ownership or authorization.

## Permissions and data flow

- Compare every platform node with all permission declarations.
- Trace network access and external data transmission: what leaves the user's environment, where it goes, and whether the README explains it.
- Check `credential_access` declarations without asking for or accepting credential values.
- Inspect file-read and file-write nodes, paths, overwrite behavior, and possible access outside intended locations.
- Inspect email sending, social publishing, automatic messages, webhooks, or any other action that affects people or public systems.
- Check whether the declared safety fields and risk level match the real behavior.

## Code and automatic actions

- Read every Code, Function, script, expression, template, or shell-capable node as untrusted text.
- Look for command execution, dynamic evaluation, encoded payloads, downloads, hidden network calls, data exfiltration, destructive file operations, or bypasses of platform controls.
- Do not run Code nodes to discover what they do.
- Require clear Human Review before irreversible, public, financial, destructive, or externally visible actions.

## Human Review

- Confirm that `human_review.required` matches the actual flow.
- Check that every listed checkpoint exists in the source and occurs before the risky action.
- Confirm that a user can inspect and reject the proposed action at each checkpoint.
- Do not accept a README statement as proof if the source has no real checkpoint.

## Examples and documentation

- Confirm that example inputs and outputs are safe, fictional, representative, and consistent with the manifest.
- Check that setup instructions do not encourage hard-coded credentials or insecure permissions.
- Confirm that external services, data retention, limitations, costs, and side effects are understandable.

## Risks the Validator cannot fully detect

The current Validator may miss unknown or community nodes, unusual secret formats, obfuscated instructions, indirect network access, malicious prompts, dynamic code, inaccurate metadata, unsafe service behavior, license violations, and differences between declared and real runtime behavior. It also cannot prove quality, usefulness, compatibility, or that a Workflow will execute correctly.

Record unresolved uncertainty in the Pull Request. Request changes or reject the Package when reviewers cannot understand its behavior or verify its rights and safety declarations. A green CI result is evidence that current automated rules passed, not a security certification or endorsement.
