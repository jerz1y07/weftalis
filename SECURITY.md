# Security Policy

Weftalis is an early experimental open-source project. Its Validator, Registry Builder, secret scanner, and review process reduce risk, but they cannot prove that a Workflow is absolutely safe.

## Protect secrets and sensitive data

- Do not commit a real password, token, API key, credential, private key, session value, or other secret.
- Do not include real credentials in `workflow.yaml`, platform exports, README files, examples, fixtures, logs, screenshots, Issues, or Pull Requests.
- Use the target platform's secure credential storage at runtime. A Package may declare `credential_access: true`, but must not contain the credential value.
- Remove secrets and private user data from diagnostic output before sharing it.

If a real secret is exposed, revoke or rotate it through its provider immediately. Removing it from a later commit is not enough because earlier Git history may still contain it.

## Reporting a security problem

Do not disclose a real secret or an exploitable vulnerability in a public Issue.

The repository is public, but this policy does not yet claim that a private reporting channel has been verified. Do not use a private email address or an invented contact as a workaround. Maintainers should verify GitHub Private Vulnerability Reporting and then document the confirmed path here.

Until a confirmed private reporting path is documented, keep sensitive evidence out of the repository and public discussion. Non-sensitive hardening suggestions that do not reveal an exploitable weakness may use the normal feature request process. The missing confirmed private channel is a known release limitation, not permission to post sensitive details publicly.

## Limits of automated checks

The Validator and secret scanner use structural validation, known platform patterns, and heuristic secret patterns. They can produce both false positives and false negatives. They may not recognize an unknown node, obfuscated value, unusual credential format, misleading description, unsafe external service, or harmful embedded instruction.

A passing Validator or CI result means only that the submitted files passed the current automated rules. It is not a security certification, endorsement, license verification, or permission to execute the Workflow. Human review of source files, declared permissions, data flows, licenses, examples, and intended behavior remains required.
