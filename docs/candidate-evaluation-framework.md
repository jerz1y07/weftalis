# Weftalis Candidate Evaluation Framework

## Status and scope

This Phase 11A framework is for static, research-only triage of public open-source
projects that might later inform a Weftalis Workflow Package. It does not approve,
import, install, execute, or test any third-party software. It does not change the
Weftalis Workflow Package Specification, Validator, Registry Builder, Registry
data, existing packages, website, deployment, or release state.

Static review can identify documented capabilities, obvious risk, license terms,
and provenance signals. It cannot prove that a candidate is safe, non-malicious,
correct, compatible, or executable. A later import still requires source-level
manual review, license review, adaptation, secret scanning, package validation,
platform testing in an isolated environment, and human approval.

Research snapshot date: **2026-07-20**.

## Target content workflow

Candidates are mapped to one or more of these categories:

1. Source and material discovery
2. Trend and topic filtering
3. Topic generation
4. Research brief creation
5. Draft writing
6. Voice and style rewriting
7. Social media card generation
8. Human review
9. Feedback collection and analysis

A project does not need to cover the entire sequence. A narrow tool can remain
useful research evidence, but a tool is not a Workflow and cannot enter the main
Registry unless the repository also contains an identifiable upstream Workflow
artifact that passes the admission rule below.

## Candidate object types

- **Open-source tool:** a library, CLI, service, application, renderer, linter,
  agent framework, or other capability. A tool alone is not an admissible
  Workflow.
- **Existing upstream Workflow:** a concrete, reusable orchestration artifact
  already committed by the upstream author, such as an n8n JSON export, Dify DSL,
  or source file explicitly implementing a Workflow in another engine.
- **Example or template:** an upstream Workflow artifact intended for learning,
  demonstration, scaffolding, or proof of concept. It is real provenance-bearing
  material, but completeness and production readiness must not be assumed.
- **Weftalis-authored adapter:** a new Workflow designed by Weftalis around an
  upstream tool or API. It may be useful local engineering, but it is not an
  ecosystem import and is out of scope for the main Registry.
- **Reference-only candidate:** a tool, application, architecture, unsupported
  Workflow, or insufficiently proven artifact retained for research but not
  eligible for packaging in the current phase.

## Main Registry admission rule

> A candidate may enter the main Weftalis Registry only when an identifiable
> upstream Workflow artifact already exists and its exact repository, file path,
> author, license, and pinned revision can be documented.

A tool alone is not an admissible Workflow.

An adaptation is allowed only when it is a faithful transformation of an
existing upstream Workflow. It must preserve the original Workflow logic and
document every transformation. It must not be a newly invented Workflow built
around an upstream tool.

## Evidence policy

Use evidence in this order:

1. The primary GitHub repository owned by the named author or organization.
2. The repository's license file, security policy, releases, tags, and commit
   history.
3. Official project documentation or an official package registry maintained by
   the same project.
4. A paper or institutional project page linked by the primary repository.

Search indexes and third-party catalogs may help discovery, but they are not
sufficient evidence for admission. Popularity, stars, a public repository, or an
"open source" label do not substitute for a license and traceable authorship.

Record the access date and a concrete maintenance signal, such as a release,
maintainer-authored commit, security fix, or official changelog entry. A newly
opened community issue alone is not a maintenance signal.

Do not copy credentials, private data, private repository content, or secrets.
Do not download, install, import, or run a candidate during this phase.

## Decision classes

### Directly admissible

The candidate is an identifiable upstream Workflow artifact, has a clear
reusable license and file-level provenance, is relevant to the target Workflow,
and appears to need only Weftalis packaging and documentation rather than logic
changes or redesign.

This label is not a safety or execution claim. The export must still pass all
later manual and automated checks. Phase 11A found no candidate that met this
threshold.

### Admissible after adaptation

The candidate is an identifiable upstream Workflow artifact with clear
provenance and a determinable license, but requires a faithful format conversion,
credential redaction, removal of exported instance identifiers, documentation,
or narrowly bounded safety changes. The transformed package must preserve the
upstream logic and record every change file by file.

This class does not apply to a library, CLI, service, or tool without an upstream
Workflow artifact. A clean-room Workflow newly designed around a tool is a
Weftalis-authored adapter, not an import.

### Reference only

The project provides useful architecture, tooling, threat-model, interaction, or
UX ideas, but is not an admissible import source. This includes tools with no
upstream Workflow artifact, unsupported or oversized Workflow platforms,
examples with unresolved authorship or licensing, and artifacts whose logic
would need to be reinvented rather than faithfully transformed.

Reference-only ideas must be reimplemented independently unless the applicable
license and attribution path are reviewed and recorded.

### Reject

Do not use the candidate as an import source. Reasons include indeterminate
license, weak or contradictory provenance, archived or abandoned source combined
with high risk, embedded secrets, hidden behavior, autonomous destructive or
public actions without review, or a scope that cannot be reduced safely.

Rejected aggregations with unclear per-item rights are recorded only in the
screening log. They are not treated as reusable candidates.

## Evaluation fields

Every mapped candidate records the following fields.

| Field | Required interpretation |
| --- | --- |
| Project name | Upstream name, plus a specific workflow or component when the repository is broad. |
| Candidate object type | Tool, existing upstream Workflow, example/template, Weftalis-authored adapter proposal, or reference-only candidate. |
| Exact Workflow file path | Required for Registry admission; repository-relative path to the existing upstream artifact. |
| Source URL | Primary GitHub repository; add official documentation only when it supports a separate fact. |
| Original author or organization | Copyright owner or maintaining organization evidenced by the primary source. |
| License | SPDX identifier when exact; otherwise the precise determined terms and why they need review. |
| Pinned revision | Exact tag or full commit containing the reviewed Workflow file. |
| Platform | Actual upstream runtime, language, library, service, or workflow engine. |
| Last meaningful maintenance signal | Dated release, maintainer commit, or official changelog entry; not a popularity metric. |
| Workflow category | One or more of the nine Phase 11A categories. |
| Network access | `No`, `optional`, or `yes`, with the destination class when known. |
| Code execution | Whether scripts, code nodes, shell, dynamic JavaScript, browser automation, or a general-purpose runtime are used. |
| Credential requirements | `None`, `optional`, or `required`, naming credential classes but never values. |
| External side effects | File/database writes, notifications, webhooks, publishing, messages, or other observable changes. |
| Human review support | `None`, `partial`, or `explicit`, distinguishing feedback UI from a real pre-action approval gate. |
| Provenance quality | `High`, `medium`, or `low`, based on ownership, history, source specificity, and licensing. |
| Adaptation effort | `Low`, `medium`, `high`, or `very high` for a focused n8n/Dify package. |
| Transformation boundary | Every proposed change to the existing Workflow, with confirmation that the original logic is preserved. |
| Security concerns | Main trust boundaries, data flows, and capability risks visible through static review. |
| Recommended Weftalis decision | One of the four classes, followed by the concrete reason. |

## Rating guidance

### Provenance quality

- **High:** primary repository; clear named owner; repository-wide license; useful
  history, releases, security policy, or official documentation.
- **Medium:** primary repository and license are clear, but the exact example has
  limited history, few maintainers, generated content, or ambiguous subcomponent
  ownership.
- **Low:** repository ownership may be visible, but individual workflow authorship,
  copied prompts, embedded assets, or license coverage is not traceable. Low
  provenance normally leads to reference-only or reject.

### Adaptation effort

- **Low:** compatible upstream n8n/Dify export requiring packaging, metadata,
  redaction, documentation, and review only.
- **Medium:** an existing upstream Workflow requires a faithful format conversion
  or limited, documented safety changes that preserve its logic.
- **High:** an existing upstream Workflow uses an unsupported runtime or needs
  substantial changes whose faithfulness requires careful review.
- **Very high:** a broad application, database-backed platform, autonomous
  executor, or multi-service deployment would have to be decomposed or
  independently redesigned. Such work is normally reference-only because a new
  design would not be an upstream Workflow import.

## Security review questions

For each candidate, reviewers should ask:

- Which URLs, feeds, search engines, model providers, or local services receive
  data?
- Can untrusted page text or retrieved documents influence later tool calls?
- Can the candidate execute code, JavaScript, browser actions, or shell commands?
- Does it read or write files, databases, vector stores, histories, or analytics?
- Does it require credentials, and can every credential remain in the runtime's
  secure credential store rather than the package?
- Can it send alerts, email, webhooks, surveys, messages, images, or public posts?
- Is there a real pause where a human can inspect, reject, or edit output before
  an externally visible action?
- Can source citations be preserved from discovery through brief and draft?
- Are robots.txt, rate limits, source terms, copyright, personal data, and data
  retention documented?
- Can the useful behavior be reduced to least privilege and made deterministic?

Prompt injection, compromised upstream services, malicious page content,
misleading citations, model hallucination, package dependency risk, license
incompatibility, and inaccurate permission declarations remain possible even
when a static review looks favorable.

## Admission gates for a future phase

Before any candidate becomes a Workflow Package, all of these gates must pass:

1. Identify the exact upstream Workflow file, its repository, original author,
   license, and full pinned commit or tag. A tool without this artifact stops here.
2. Review every source file, node, prompt, expression, dependency, and bundled
   asset as untrusted content without executing it.
3. Record whether the Workflow is copied unchanged or faithfully transformed.
   Document every transformation and prove that the original Workflow logic is
   preserved. Independent reimplementation is not an import.
4. Remove credential values, personal identifiers, cached data, webhook URLs,
   exported account IDs, and unsafe sample content.
5. Reduce permissions, disable automatic publishing or messaging, and add an
   actual human checkpoint before every external or irreversible action.
6. Declare network, filesystem, code execution, credential, data retention, and
   side-effect behavior truthfully in `workflow.yaml`.
7. Use fictional examples and documented source URLs; preserve provenance in
   outputs and state uncertainty explicitly.
8. Validate the package, then test only in a later approved isolated environment
   with disposable credentials and controlled endpoints.
9. Obtain human maintainer approval. Passing the Validator or an isolated test is
   not a security certification or legal opinion.

## Phase 11A stopping rule

Phase 11A ends with documentation and human review. It must not create Workflow
Packages, modify Registry JSON, install or run candidates, connect accounts,
deploy, publish, commit, tag, or release anything.
