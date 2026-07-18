# Weftalis Product Direction

## Product Vision

Weftalis aims to become an open, trustworthy catalog where AI workflows can be published, discovered, inspected, validated, versioned, and reused across tools. The registry should favor transparent files, portable metadata, human review, and simple tooling over a closed execution platform.

The official product description is: Weftalis is an open-source registry for publishing, inspecting, validating, versioning, and reusing workflows across platforms.

## Skill vs. Workflow

A **Skill** is a focused capability or reusable instruction set, such as summarizing a document or extracting structured data. It describes what an agent can do and may be used as one building block.

A **Workflow** is an ordered process that coordinates one or more skills, prompts, tools, inputs, outputs, and decision points to achieve a broader result. A workflow describes how work moves from a starting condition to an outcome.

In short, a skill is a capability; a workflow is an orchestrated process that may use several capabilities.

## Primary User Scenarios

- An author publishes a versioned workflow package with clear metadata and documentation.
- A user searches or browses workflows for a specific task.
- A user inspects a workflow's contents, requirements, permissions, and history before reuse.
- A maintainer validates a submitted package against the shared specification.
- A tool developer maps a portable workflow package into a tool-specific format through an adapter.

## First-Version User Flow

1. An author copies an example package and describes the workflow in plain files.
2. The author runs the local validator.
3. The author submits the package through a GitHub pull request.
4. Automated checks and human review inspect structure, metadata, and safety declarations.
5. An accepted package appears in the registry data and static website.
6. A user reads the package details and downloads or adapts it for local use.

The registry does not execute the workflow in this flow.

## Potential Risks

- Malicious or misleading workflow packages may be submitted.
- A workflow may request unsafe permissions or expose secrets.
- Specifications may become too complex before real user needs are understood.
- Tool-specific formats may reduce portability or create maintenance burden.
- Metadata may be inaccurate, incomplete, or difficult to verify.
- Users may assume that listing implies security, quality, or endorsement.
- Fast specification changes may break early packages and adapters.

Risk reduction should begin with explicit metadata, local validation, human-readable packages, version history, cautious review, and clear disclaimers.
