# Instructions for Coding Agents

These instructions apply to the entire repository.

## Project Context

- The project owner is a programming beginner.
- Explain every operation in simple Chinese before or while performing it.
- Break work into small, understandable tasks.
- Do not implement many features at once.

## Brand

- The official public brand name is **Weft Place**.
- Use **Weft Place** for user-facing product references.
- Preserve `Weftalis` and `weftalis` only where an existing technical identifier, repository name, URL, schema ID, package ID, or source path requires it.
- The generic phrase “open workflow registry” may continue to describe the product category, but it is not the product name.
- Follow [BRAND.md](BRAND.md) for naming and visual-direction guidance.

## Admission and Evidence Policy

- Weft Place is an open-first AI Workflow Registry. Human review is an
  escalation mechanism, not a universal prerequisite for public Listing.
- Keep these states distinct: `Discovered`, `Listed`, `Static reviewed`,
  `Runtime tested`, `Compatibility verified`, `Human reviewed`, `Featured`,
  and `Quarantined` / `Removed`.
- `Listed` means only that Weft Place included a real Workflow with a traceable
  source and sufficient minimum admission evidence. It does not imply safety,
  security, runtime testing, compatibility, production readiness, quality,
  human review, or recommendation.
- Ordinary Listing requires recorded provenance, no clear blocking license
  issue, a parseable and structurally plausible artifact, and no obvious
  secret leakage, malicious content, or other high-confidence quarantine
  signal. Independent runtime testing is not mandatory.
- Escalate ambiguous provenance or licensing, credentials, suspicious code
  execution, filesystem or destructive writes, external publishing, high-risk
  network behavior, substantial source transformation, reports or complaints,
  higher trust claims, and Featured or curated placement to human review.
- Listing, Workflow Package creation, and Adapter creation are separate
  decisions. A public Listing does not require a local `packages/` Package, and
  an Adapter is optional unless it is needed for a supported acquisition or
  compatibility path.
- The source model must support both repository-backed artifacts and future
  direct uploads. Never invent repository provenance for an upload. Direct
  uploads must enter an isolated Intake or quarantine boundary and must never
  directly mutate `packages/`, `registry/`, or `website/`.
- GitHub is an engineering and provenance source, not an account requirement
  for ordinary product use. Do not infer runtime, safety, compatibility, or
  production-readiness claims from parsing, schema validation, static review,
  or Listing status.

## Safety and Scope

- Never store passwords, tokens, API keys, or other secrets in the repository.
- Do not add a database, payments, user accounts, or online workflow execution unless the owner explicitly requests them in the future.
- Prefer the simplest, safest, and most reversible option when requirements are uncertain.
- Avoid destructive operations and preserve existing user work.
- Do not connect external services, deploy the project, or introduce unnecessary dependencies without explicit approval.

## Working Method

- State the intended small change in simple Chinese before editing.
- Keep changes focused on the requested task.
- After making changes, list every changed file.
- Run relevant checks when checks are available and report the result clearly.
- If no automated check exists, perform a simple structural or content check.
- Stop after the requested scope is complete; do not automatically begin the next roadmap phase.
