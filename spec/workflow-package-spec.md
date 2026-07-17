# Workflow Package Specification v0.1

## 1. Purpose

The Workflow Package Specification defines a small, portable metadata format for describing an AI workflow. It is a wrapper and description standard, not a new workflow execution language.

The original workflow file remains authoritative for execution. An n8n workflow is executed by n8n, and a dify workflow is executed by Dify. A conforming package does not execute a workflow and must not contain passwords, tokens, API keys, or other credential values.

Version 0.1 intentionally favors explicit declarations and human readability over completeness.

## 2. Package layout

A package should contain at least:

```text
workflow-package/
├── workflow.yaml       # Metadata described by this specification
├── README.md           # Human-readable usage documentation
└── <source file>       # Original n8n or Dify workflow export
```

Paths in metadata are relative to the package root and use `/` as the separator. Absolute paths, Windows drive paths, backslashes, and `..` path segments are not allowed. Package authors may also include example input and output files.

## 3. Conformance words

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** describe requirements.

- A **required** field MUST be present.
- An **optional** field MAY be omitted.
- Unknown top-level fields are not allowed in v0.1.
- Dates MUST use the ISO 8601 full-date form `YYYY-MM-DD`.
- Versions MUST use semantic versioning, such as `1.0.0` or `1.2.0-beta.1`.
- `license` MUST be an SPDX-style license expression or identifier, such as `MIT`, `Apache-2.0`, or `MIT OR Apache-2.0`.

### Specification version and package version

`spec_version` selects the version of this metadata standard and is fixed to `0.1` for this release. `version` identifies the release of the individual Workflow Package and changes when that package changes. Updating a Workflow Package from `1.0.0` to `1.1.0` does not change `spec_version` unless the package adopts a different specification release.

## 4. Top-level fields

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `spec_version` | string | Yes | Specification version used by the metadata. For this release it MUST be `0.1`. |
| `id` | string | Yes | Stable lowercase identifier. It MUST use letters, digits, and hyphens, beginning and ending with a letter or digit. |
| `name` | string | Yes | Human-readable workflow name. |
| `version` | string | Yes | Semantic version of the workflow package. |
| `description` | string | Yes | Short explanation of the workflow's purpose. |
| `author` | string | Yes | Name of the person or organization responsible for the package. |
| `repository` | string | No | HTTPS URL for the source repository or project page. |
| `license` | string | Yes | SPDX-style license identifier or expression. |
| `runtime` | object | Yes | Original platform and source-file requirements. |
| `categories` | array of strings | No | Broad discovery groupings. An empty array is allowed. Omission means no categories are declared. |
| `tags` | array of strings | No | More specific discovery terms. An empty array is allowed. Omission means no tags are declared. |
| `inputs` | array of input objects | Yes | Values accepted by the workflow. An empty array is allowed. |
| `outputs` | array of output objects | Yes | Values produced by the workflow. An empty array is allowed. |
| `dependencies` | object | Yes | External services, models, and tools needed by the workflow. |
| `permissions` | object | Yes | Explicit declaration of sensitive capabilities. |
| `human_review` | object | Yes | Whether human approval is required and where it occurs. |
| `safety` | object | Yes | Data-handling and risk declarations. |
| `testing` | object | No | Current testing status and optional test details. Omission means no testing claim is made. |
| `files` | object | Yes | Paths to the README and optional example files. |

## 5. Runtime

`runtime` MUST contain all of the following fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `platform` | string | Yes | Lowercase execution-platform identifier. v0.1 allows only `n8n` or `dify`. |
| `minimum_version` | string | Yes | Minimum supported platform version, expressed as semantic versioning. |
| `source_file` | string | Yes | Relative path to the original platform export. |

The registry does not interpret or replace `source_file`.

## 6. Inputs and outputs

Each item in `inputs` MUST contain:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `name` | string | Yes | Machine-readable input name. |
| `type` | string | Yes | One of `string`, `number`, `integer`, `boolean`, `object`, `array`, or `file`. |
| `required` | boolean | Yes | Whether a caller must provide the input. |
| `description` | string | Yes | Human-readable meaning of the input. |

Each item in `outputs` MUST contain:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `name` | string | Yes | Machine-readable output name. |
| `type` | string | Yes | One of the same types allowed for inputs. |
| `description` | string | Yes | Human-readable meaning of the output. |

Unknown fields are not allowed inside input or output items.

## 7. Dependencies

`dependencies` MUST contain `services`, `models`, and `tools`. Each field is an array of strings and may be empty.

- `services` lists external network services, such as an email delivery service.
- `models` lists required AI models or model families.
- `tools` lists non-model tools or platform integrations.

Dependency names are descriptive in v0.1; there is no global dependency identifier registry.

## 8. Permissions

`permissions` MUST contain every field below. Every value MUST be a boolean. Authors MUST declare the actual behavior of the original workflow, not merely its intended behavior.

| Field | Meaning when `true` |
| --- | --- |
| `network_access` | The workflow makes outbound network requests. |
| `filesystem_read` | The workflow reads files from a filesystem. |
| `filesystem_write` | The workflow creates or changes filesystem content. |
| `email_send` | The workflow sends email. |
| `social_publish` | The workflow publishes content to a social platform. |
| `code_execution` | The workflow executes code or shell commands. |
| `credential_access` | The workflow reads credentials supplied securely by its execution platform. |

`credential_access: true` declares a runtime need. It does not permit credentials to be stored in the package. Credential values MUST NOT appear anywhere in a package.

JSON Schema can confirm that these declarations exist and are boolean values. It cannot prove that they truthfully describe the original workflow file.

## 9. Human review

`human_review` MUST contain:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `required` | boolean | Yes | Whether execution requires a human decision. |
| `checkpoints` | array of strings | Yes | Human-readable approval points. |

When `required` is `true`, `checkpoints` MUST contain at least one item. When `required` is `false`, `checkpoints` MUST be empty.

## 10. Safety and privacy

`safety` MUST contain:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `stores_user_data` | boolean | Yes | Whether the workflow persistently stores user-provided data. |
| `sends_data_externally` | boolean | Yes | Whether user or workflow data is sent to an external service. |
| `contains_credentials` | boolean | Yes | Whether the package contains credential values. Conforming registry packages SHOULD set this to `false`; credentials MUST NOT be committed. |
| `risk_level` | string | Yes | Overall declared risk: `low`, `medium`, or `high`. |

Risk level is an author declaration in v0.1, not a security certification.

## 11. Testing

`testing` is optional. When present, it MUST contain `status` and MAY contain test details:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `status` | string | Yes | One of `untested`, `passed`, or `failed`. |
| `last_tested` | string | No | Date of the most recent test in `YYYY-MM-DD` form. |
| `tested_platform_version` | string | No | Semantic version of the platform used for the test. |

Omitting `testing` means that the package makes no testing claim. `status: untested` is also allowed when an author wants to declare that state explicitly. A status reports what the author knows; it does not imply registry endorsement.

## 12. Files and documentation

`files` MUST contain `readme` and MAY contain example paths:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `readme` | string | Yes | Relative path to package documentation, normally `README.md`. |
| `example_input` | string | No | Relative path to an example input file. |
| `example_output` | string | No | Relative path to an example output file. |

All four file-reference fields (`runtime.source_file`, `files.readme`, `files.example_input`, and `files.example_output`) use paths relative to the Workflow Package root. JSON Schema rejects paths beginning with `/`, Windows drive prefixes such as `C:`, backslashes, and `..` path segments.

## 13. What v0.1 does not validate

The specification and JSON Schema cannot determine whether:

- the original n8n or Dify file is executable, safe, or compatible with the declared platform version;
- permissions, dependencies, data handling, risk level, or testing claims are truthful;
- referenced files and URLs exist or their contents match the metadata;
- an SPDX-style license string is a currently valid SPDX expression;
- a workflow is useful, high quality, non-malicious, or legally safe;
- secrets are hidden inside source files or documentation;
- input and output types match the actual runtime behavior.
- a referenced path exists, has the expected file type, or remains inside the package after symbolic links are resolved.

These checks may require a future Validator, platform-specific inspection, secret scanning, and human review. They are outside Phase 3.
