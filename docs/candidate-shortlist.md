# Weftalis Phase 11A Candidate Shortlist

## Shortlist status

This shortlist contains **11 research-backed candidates** selected from the
[candidate map](candidate-map.md) using the
[evaluation framework](candidate-evaluation-framework.md). It is a proposal for
human review, not an import authorization.

No shortlisted project was downloaded, installed, imported, or executed. No
Workflow Package was created. Static review does not prove that a candidate is
safe, executable, compatible, or legally suitable at a future version.

Research snapshot date: **2026-07-20**.

## Phase 11B1 direction correction

This document originally treated promising tools as possible adaptation targets.
That was too broad. Trafilatura, Vale, TrendRadar, STORM, Satori, and the other
tool-level entries below are research references unless an exact upstream
Workflow artifact is separately identified.

A tool, library, CLI, service, or application is not an admissible Workflow.
Weftalis must not invent a new Workflow around it and describe that new work as
an ecosystem import. The binding admission rule is in the
[evaluation framework](candidate-evaluation-framework.md#main-registry-admission-rule).

## Selection priorities

The shortlist favors candidates that have:

- a primary repository, named owner, and determinable open-source license;
- a concrete function in the nine-step content workflow;
- a recent or otherwise meaningful maintenance signal;
- an output that can be inspected before the next step;
- an identifiable upstream Workflow file whose logic can be preserved; and
- useful provenance or citation behavior.

It deprioritizes broad autonomous agents, full observability platforms, browser
automation, database/account systems, automatic publishing, and overlapping
tools when a smaller candidate covers the same function.

## Historical tool/reference shortlist

The decisions in this table are corrected to reference-only at the project
level. They do not authorize packaging. A separate artifact-level shortlist is
maintained in [upstream-workflow-candidates.md](upstream-workflow-candidates.md).

| Rank | Candidate | Upstream license | Best-fit categories | Decision | Main reason to shortlist | Main blocker |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | [Trafilatura](https://github.com/adbar/trafilatura) | Apache-2.0 from v1.8.0 | 1, 4 | Reference only — tool | Narrow, provenance-aware public-page extraction; v2.1.0 released 2026-06-07. | No upstream Workflow artifact was identified. |
| 2 | [Vale](https://github.com/vale-cli/vale) | MIT core | 6, 8 | Reference only — tool | Deterministic, declarative style diagnostics are easier to inspect than an autonomous rewrite. | No upstream Workflow artifact was identified; style packs also need separate review. |
| 3 | [STORM / Co-STORM](https://github.com/stanford-oval/storm) | MIT code | 1, 3, 4, 5, 8 | Reference only — application | Strong research provenance and a clear question → evidence → outline → cited draft structure. | No supported importable Workflow artifact was selected. |
| 4 | [TrendRadar](https://github.com/sansan0/TrendRadar) | MIT | 1–4 | Reference only — application | Directly addresses cross-source trends, keyword filtering, topic signals, and briefs; active 2026 releases. | No supported importable Workflow artifact was identified. |
| 5 | [Satori](https://github.com/vercel/satori) | MPL-2.0 | 7, 8 | Reference only — tool | Deterministic rendering with active releases and local-asset potential. | A new card Workflow around the renderer would be Weftalis-authored. |
| 6 | [Temporal OpenAI Agents SDK research demos](https://github.com/temporal-community/openai-agents-demos) | MIT | 1, 3, 4, 5, 7, 8 | Reference only — upstream Workflow on unsupported platform | Concrete Workflow source exists. | Temporal/Python is unsupported; conversion must not become a logic rewrite. |
| 7 | [GPT Researcher](https://github.com/assafelovic/gpt-researcher) | Apache-2.0 | 1–5 | Reference only — application | Actively maintained, cited-report focus, and many provider options. | No supported importable Workflow artifact was selected. |
| 8 | [changedetection.io](https://github.com/dgtlmoon/changedetection.io) | Apache-2.0 | 1, 2 | Reference only — application | Reliable source-change signals are useful research. | A new consuming Workflow would be Weftalis-authored. |
| 9 | [LanguageTool](https://github.com/languagetool-org/languagetool) | LGPL-2.1-or-later core | 6, 8 | Reference only — tool | Mature multilingual grammar/style suggestions. | No upstream Workflow artifact was identified. |
| 10 | [RSSHub](https://github.com/DIYgod/RSSHub) | AGPL-3.0 | 1 | Reference only — service | Broad source discovery and strong core provenance. | No upstream Workflow artifact was identified; route-specific terms remain. |
| 11 | [Formbricks](https://github.com/formbricks/formbricks) | AGPL-3.0 core | 8, 9 | Reference only — application | Strong real-human survey and feedback model. | No upstream Workflow artifact was identified and the application exceeds current scope. |

Categories use the numbering in the evaluation framework.

## Historical adapter concepts — not an import batch

The five sections below preserve the original Phase 11A design research. They are
Weftalis-authored adapter ideas around tools, not ecosystem imports. They must not
be used to create main Registry packages unless a separate, identifiable upstream
Workflow file is later found and any adaptation faithfully preserves its logic.

### A. Trafilatura — reference-only adapter idea

Recommended upstream baseline: **2.1.0**, Apache-2.0, released 2026-06-07.

The first adaptation should accept reviewer-supplied public URLs, return cleaned
text plus URL/title/date metadata, and stop for evidence review. It should not
crawl a domain, follow arbitrary links, use authenticated pages, or write files.
URL allow/deny rules, size/time limits, robots/source-term documentation, and
SSRF defenses need design review before implementation.

Expected declarations: network access and external data transfer; code execution
only if the final implementation actually invokes a local code/service boundary.
No credentials, messaging, or publishing should be required.

### B. TrendRadar — reference-only adapter idea

Recommended upstream baseline: **v6.8.0**, MIT, released 2026-05-23.

The useful adaptation is the read-only sequence: ingest a small approved set of
public feeds/trend endpoints, normalize titles/URLs/timestamps, deduplicate,
apply declared keywords, and produce ranked topic candidates with source links.
Do not copy the full scheduler/MCP application and do not enable email, chat,
webhook, cloud storage, or social pushes.

The reviewer must approve sources and filtered topic candidates before research.
The external NewsNow dependency, source rate limits, and prompt-injection
handling remain open questions.

### C. STORM — reference-only adapter idea

Recommended upstream baseline: exact commit to be chosen after checking the
current MIT license and the latest `knowledge-storm` release history.

Adapt only the inspectable structure: generate research questions from several
declared perspectives, retrieve evidence from reviewer-approved sources, show a
claim/source table, pause for evidence approval, and then produce an outline and
brief. Do not reproduce the hosted preview's data collection and do not treat
generated citations as verified.

The initial package should stop at a brief or clearly marked draft. It should not
publish, and model/search credentials must remain in the runtime credential
store. Retrieved content must be treated as untrusted prompt input.

### D. Vale — reference-only adapter idea

Recommended upstream baseline: **v3.15.1**, MIT core, released 2026-06-12.

Phase 11B1 audit note: Phase 11A originally observed **v3.14.2**, released
2026-05-15. The official Vale release and commit were rechecked during Phase
11B1, which verified and pinned v3.15.1 while preserving the earlier observation
for traceability.

Use a tiny, locally stored, separately licensed rule set to produce annotations
against a draft. The workflow should show the original text and every diagnostic,
then require a human to accept, reject, or edit. It must not silently apply fixes
or claim that a clean lint report proves good writing.

The exact style rules, their authors/licenses, supported language, and false
positive policy must be chosen before a package is created.

### E. Satori — reference-only adapter idea

Recommended upstream baseline: **0.27.0**, MPL-2.0, released 2026-04-30.

Use a fixed, audited template and local, license-cleared fonts/assets to render a
preview from approved title/subtitle/source fields. Treat all text as data, reject
markup/script input, and do not fetch arbitrary remote assets. Show the preview
at a visual approval gate and return the asset only; never publish it.

The later implementation must determine whether SVG alone is sufficient or a
separately reviewed rasterizer is required, and must preserve MPL notices for any
covered modified files.

## Why these five were originally grouped

Together they illustrate possible boundaries across the content workflow, but
the sequence is a Weftalis design concept rather than an imported upstream
Workflow:

```text
approved public sources
  -> extracted material
  -> filtered topic candidates
  -> evidence-reviewed research brief
  -> deterministic style findings
  -> human-approved card preview
```

They deliberately leave automatic publication out. They also postpone survey
data, user accounts, databases, email, remote feedback platforms, browser
automation, and general autonomous code execution.

## Strong candidates deferred from the first batch

- **Temporal research demos:** valuable concrete orchestration reference, but the
  first research package should avoid Temporal, optional PDF/native dependencies,
  image generation, and a mandatory paid-provider coupling.
- **GPT Researcher:** active and capable, but a first import should have fewer
  retrievers/providers and a smaller prompt-injection surface.
- **changedetection.io:** useful after a stable source list exists; a simple feed
  poll may be enough initially.
- **LanguageTool:** valuable for multilingual checks, but Vale offers a smaller
  deterministic first style gate. Revisit when supported languages are chosen.
- **RSSHub:** prefer consuming approved feed URLs as an external dependency;
  copying AGPL route code into Weftalis is not a first-batch task.
- **Formbricks:** feedback collection is important, but consent, personal data,
  credentials, database/accounts, retention, and deletion require a dedicated
  privacy review. Start later with a user-supplied, redacted feedback export.

## Rejected and excluded sources

| Source | Reason |
| --- | --- |
| [Agent Laboratory](https://github.com/SamuelSchmidgall/AgentLaboratory) | Reject for this pipeline: autonomous Python experiments, data/model access, file writes, optional LaTeX execution, and AgentRxiv upload are defining behavior and exceed the content scope. |
| [CrewAI examples](https://github.com/crewAIInc/crewAI-examples) | Archived; no repository-wide license was established for the Content Creator Flow because the repository instructs users to check individual examples. |
| [Awesome Dify Workflow](https://github.com/svcvit/Awesome-Dify-Workflow) | Repository license is visible, but individual DSL provenance is missing or informal for multiple entries. |
| [n8nworkflows.xyz](https://github.com/nusquama/n8nworkflows.xyz) and similar bulk galleries | The archive's license does not establish rights to thousands of copied workflows; pseudonymous metadata and per-item license gaps prevent admission. |

## Open uncertainties for human review

1. Whether Weftalis should permit packages that call AGPL services without
   copying AGPL code, and what notice is required.
2. Whether the first extraction package may depend on a local helper service, or
   must use only built-in n8n/Dify nodes.
3. Which search or trend sources are legally and operationally acceptable,
   including robots rules, source terms, rate limits, and regional availability.
4. Which model provider or local model is acceptable, how data retention is
   disclosed, and how spending limits are enforced.
5. Whether STORM's 2025 maintenance signal is recent enough; this must be checked
   again before choosing a commit.
6. Which Vale style rules and fonts/assets for Satori have licenses compatible
   with their intended package distribution.
7. What minimum provenance fields must survive every step: source URL, retrieval
   time, author/publisher, license/usage note, extraction warning, and claim links.
8. What a real human checkpoint looks like in each supported n8n/Dify version;
   a prompt that says "review this" is not an enforceable pause.
9. How feedback can be collected later without adding accounts or a database to
   Weftalis and without storing identifiable respondent data in a package.
10. What isolated test environment and disposable credentials a later phase may
    use. Phase 11A did not authorize any execution.

## Human decision requested

Before any import phase, a maintainer should approve or revise:

- the artifact-level candidates in
  [upstream-workflow-candidates.md](upstream-workflow-candidates.md);
- the corrected rule that tool-only adapter ideas cannot enter the main Registry;
- the proposed least-privilege boundaries;
- the handling of copyleft and component-specific licenses;
- the accepted source/model/service dependencies; and
- the required human review mechanism.

Stop after this review. Do not create a package, update Registry JSON, install a
candidate, connect an account, deploy, publish, commit, tag, or release based only
on this shortlist.
