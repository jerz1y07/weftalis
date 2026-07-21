# Weftalis Phase 11A Candidate Map

## Research boundary

This map is a static research snapshot dated **2026-07-20**. Research used public
primary GitHub repositories, repository license files, release/commit history,
and official documentation. No third-party repository, workflow, package, image,
or dependency was downloaded, installed, imported, or executed.

The decision labels follow the
[candidate evaluation framework](candidate-evaluation-framework.md). They are
triage decisions, not claims that a project is safe, executable, compatible, or
legally approved. A future candidate must be frozen to a specific upstream
version and reviewed again.

## Phase 11B1 direction correction

This map began as project- and tool-level research. Its original suitability
labels are retained as historical research signals, but they do not establish
main Registry eligibility. The corrected admission rule requires an exact
upstream Workflow artifact, repository-relative file path, original author,
license, and pinned revision. A tool alone is not an admissible Workflow, and a
new Weftalis-authored adapter around a tool is not an ecosystem import.

Current object classifications:

| Candidate group | Object type for Registry admission |
| --- | --- |
| Trafilatura, Vale, LanguageTool, textlint, Satori, RSSHub | Open-source tools or services; reference only unless a separate upstream Workflow artifact is identified. |
| TrendRadar, changedetection.io, GPT Researcher, STORM, Vane, Formbricks, HumanLayer, Langfuse, Opik | Applications or frameworks; reference only unless a specific reusable upstream Workflow artifact is selected. |
| Temporal OpenAI Agents SDK demos | Existing upstream Workflow source, but on an unsupported Temporal/Python platform; artifact-level review is required and a logic rewrite is not allowed. |
| n8n Self-hosted AI Starter Kit demo | Existing upstream n8n example Workflow; eligible for artifact-level research, not automatically admissible or production-ready. |
| Agent Laboratory | Existing application/agent orchestration code previously rejected for this pipeline. |

The new artifact-level research is recorded in
[upstream-workflow-candidates.md](upstream-workflow-candidates.md). It supersedes
the import implications of the historical recommendations in individual tables.

## Historical Phase 11A decision summary

| Decision | Count | Meaning in this map |
| --- | ---: | --- |
| Directly admissible | 0 | No relevant, clearly licensed n8n/Dify export met the provenance and review threshold. |
| Admissible after adaptation | 12 | Historical tool-level suitability only; these entries are not Registry-admissible without an exact upstream Workflow artifact. |
| Reference only | 6 | Useful design evidence, but not an appropriate near-term source. |
| Reject | 1 | Determinate license/provenance, but the useful behavior cannot be separated safely enough for this content scope. |

The lack of a directly admissible result is intentional. Public workflow
collections frequently mix authors, omit per-item licenses, preserve credential
metadata, or automate publication without a real approval gate.

## Coverage matrix

| Candidate | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| RSSHub | ✓ |  |  |  |  |  |  |  |  |
| TrendRadar | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |
| changedetection.io | ✓ | ✓ |  |  |  |  |  |  |  |
| Trafilatura | ✓ |  |  | ✓ |  |  |  |  |  |
| Crawl4AI | ✓ |  |  | ✓ |  |  |  |  |  |
| GPT Researcher | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| STORM / Co-STORM | ✓ |  | ✓ | ✓ | ✓ |  |  | ✓ |  |
| Temporal OpenAI Agents SDK demos | ✓ |  | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |
| Vane | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |
| LanguageTool |  |  |  |  |  | ✓ |  | ✓ |  |
| textlint |  |  |  |  |  | ✓ |  | ✓ |  |
| Vale |  |  |  |  |  | ✓ |  | ✓ |  |
| Satori |  |  |  |  |  |  | ✓ | ✓ |  |
| Formbricks |  |  |  |  |  |  |  | ✓ | ✓ |
| HumanLayer |  |  |  |  |  |  |  | ✓ |  |
| Langfuse |  |  |  |  |  |  |  | ✓ | ✓ |
| Opik |  |  |  |  |  |  |  | ✓ | ✓ |
| n8n Self-hosted AI Starter Kit demo |  |  |  |  | ✓ |  |  |  |  |
| Agent Laboratory | ✓ |  | ✓ | ✓ | ✓ |  |  | ✓ |  |

Numbers match the nine target workflow categories in the framework.

## Candidate evaluations

### 1. RSSHub

| Field | Evaluation |
| --- | --- |
| Project name | RSSHub |
| Source URL | [DIYgod/RSSHub](https://github.com/DIYgod/RSSHub) |
| Original author or organization | DIYgod and RSSHub contributors |
| License | [AGPL-3.0](https://github.com/DIYgod/RSSHub/blob/master/LICENSE) |
| Platform | TypeScript/Node.js service; Docker deployment; HTTP RSS/Atom endpoints |
| Last meaningful maintenance signal | Repository showed a route fix merged on **2026-05-21** and continuing route activity. |
| Workflow category | 1 — source and material discovery |
| Network access | Yes — upstream sites are fetched and generated feeds are served over HTTP. |
| Code execution | Yes — general Node.js route code runs; some routes may process untrusted upstream content. |
| Credential requirements | Optional and route-specific; some sources require cookies, tokens, or authenticated sessions. |
| External side effects | Requests to source sites; cache/state writes depending on deployment; no inherent social publishing. |
| Human review support | None in the feed-generation path. A consuming workflow must add source selection and evidence review. |
| Provenance quality | High for the core project; individual upstream route legality and stability still vary. |
| Adaptation effort | Medium if called as a bounded dependency; very high if code is copied because AGPL obligations apply. |
| Security concerns | SSRF and untrusted-content handling, authenticated route secrets, source terms, rate limits, personal data, upstream HTML changes, and AGPL compatibility. |
| Recommended Weftalis decision | **Admissible after adaptation.** Prefer a workflow that consumes reviewer-approved RSSHub URLs; do not copy route code into an Apache-licensed package without legal review. |

### 2. TrendRadar

| Field | Evaluation |
| --- | --- |
| Project name | TrendRadar |
| Source URL | [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar) and its [English documentation](https://github.com/sansan0/TrendRadar/blob/master/README-EN.md) |
| Original author or organization | sansan0 (SANSAN0) and contributors |
| License | [MIT](https://github.com/sansan0/TrendRadar/blob/master/LICENSE) |
| Platform | Python, Docker, GitHub Actions, SQLite, optional MCP server and LLM providers |
| Last meaningful maintenance signal | Official changelog records **v6.8.0 on 2026-05-23** and **v6.7.0 on 2026-05-15**. |
| Workflow category | 1, 2, 3, 4 — discovery, filtering, topic generation, and AI trend briefs |
| Network access | Yes — trend sources, RSS, an external NewsNow API, optional article reader, LLMs, storage, and notification endpoints. |
| Code execution | Yes — Python application, optional MCP tooling, scheduled automation, and GitHub Actions execution. |
| Credential requirements | Optional for basic public-source use; required for LLMs, private webhooks, email, chat channels, or cloud storage. |
| External side effects | SQLite/storage writes; optional email, webhook, Slack, Telegram, Feishu, DingTalk, WeCom, ntfy, and Bark notifications. |
| Human review support | No enforceable pre-send approval gate; generated reports can be reviewed after creation. |
| Provenance quality | High for the project; dependency on third-party source APIs and source terms needs separate review. |
| Adaptation effort | High — reduce to read-only collection, deterministic filtering, and an explicit evidence checkpoint. |
| Security concerns | Webhook leakage, excessive scheduled requests, prompt injection from news, third-party availability, data retention, notification side effects, and inaccurate AI trend inference. |
| Recommended Weftalis decision | **Admissible after adaptation.** Strong pattern for discovery/filtering, but disable all pushes and remote storage in the first adaptation. |

### 3. changedetection.io

| Field | Evaluation |
| --- | --- |
| Project name | changedetection.io |
| Source URL | [dgtlmoon/changedetection.io](https://github.com/dgtlmoon/changedetection.io) and [releases](https://github.com/dgtlmoon/changedetection.io/releases) |
| Original author or organization | dgtlmoon / changedetection.io contributors |
| License | [Apache-2.0](https://github.com/dgtlmoon/changedetection.io/blob/master/LICENSE) |
| Platform | Python web application, Docker, optional browser automation and notification integrations |
| Last meaningful maintenance signal | Official release stream reached **0.55.7 on 2026-05-25**. |
| Workflow category | 1 and 2 — source change discovery and change filtering |
| Network access | Yes — watched sites, optional browser service, proxy, and notification destinations. |
| Code execution | Yes at application level; optional JavaScript/browser steps substantially increase capability. |
| Credential requirements | Optional for public watches; required for authenticated pages, proxies, protected app access, or notification services. |
| External side effects | Persists snapshots/history and may send alerts or webhooks. |
| Human review support | None before alerts; a downstream reviewer can inspect diffs. |
| Provenance quality | High. |
| Adaptation effort | Medium for a read-only public-page diff workflow; high for browser or authenticated-page behavior. |
| Security concerns | SSRF, browser automation, credential-bearing pages, retained page content, notification leaks, JavaScript actions, and source terms. |
| Recommended Weftalis decision | **Admissible after adaptation.** Limit a first design to reviewer-supplied public URLs, text diffs, and no automatic notification. |

### 4. Trafilatura

| Field | Evaluation |
| --- | --- |
| Project name | Trafilatura |
| Source URL | [adbar/trafilatura](https://github.com/adbar/trafilatura) and [official documentation](https://trafilatura.readthedocs.io/en/stable/) |
| Original author or organization | Adrien Barbaresi and contributors |
| License | [Apache-2.0 for v1.8.0 and later](https://trafilatura.readthedocs.io/en/stable/); older versions were GPL-3.0-or-later. |
| Platform | Python library and CLI for web discovery, download, and main-text/metadata extraction |
| Last meaningful maintenance signal | [PyPI release 2.1.0](https://pypi.org/project/trafilatura/) published **2026-06-07**. |
| Workflow category | 1 and 4 — material discovery/extraction and research-brief evidence preparation |
| Network access | Optional in the library; yes when its fetch/crawl features are used. |
| Code execution | Yes — Python library/CLI; no embedded workflow-level arbitrary code is required for extraction itself. |
| Credential requirements | None for public pages; caller-controlled headers or authenticated sources would change the risk. |
| External side effects | Network fetches and optional output files; no publishing or messaging. |
| Human review support | None; extracted text and metadata can be placed before an evidence review gate. |
| Provenance quality | High, including author, paper, long history, and versioned license change. |
| Adaptation effort | Medium through a tightly scoped local service or pre-approved endpoint; high if bundled into an n8n/Dify runtime. |
| Security concerns | SSRF, hostile HTML, oversized documents, robots/source terms, extraction errors, copyright, file writes, and license differences on old versions. |
| Recommended Weftalis decision | **Admissible after adaptation.** Pin v2.1.0 or later, accept only public allow-listed URLs, and preserve URL/metadata with extracted text. |

### 5. Crawl4AI

| Field | Evaluation |
| --- | --- |
| Project name | Crawl4AI |
| Source URL | [unclecode/crawl4ai](https://github.com/unclecode/crawl4ai), [releases](https://github.com/unclecode/crawl4ai/releases), and [official v0.8.5 notes](https://docs.crawl4ai.com/blog/releases/v0.8.5/) |
| Original author or organization | unclecode / Crawl4AI team and contributors |
| License | Project describes Apache-2.0 **with an additional required attribution clause** from v0.5.0; treat as non-standard until legal review. |
| Platform | Python library, headless-browser crawler, Docker/API server, optional LLM extraction |
| Last meaningful maintenance signal | **v0.8.5** was the current release reviewed on 2026-07-20 and included security and reliability fixes. |
| Workflow category | 1 and 4 — crawling, structured extraction, and research material preparation |
| Network access | Yes — target sites, proxies, model providers, and optional remote API clients. |
| Code execution | Yes — Python, browser/JavaScript execution, dynamic extraction, and server mode. |
| Credential requirements | Optional for public crawling; required for proxies, protected sites, or LLM providers. |
| External side effects | Browser/cache/state writes and network load; output persistence depends on caller. |
| Human review support | None. |
| Provenance quality | High for authorship/history; medium for license simplicity because of the added clause. |
| Adaptation effort | High. |
| Security concerns | Browser exploitation, SSRF, anti-bot/stealth behavior, hostile scripts, prompt injection, proxy secrets, resource exhaustion, source terms, and a non-standard attribution condition. |
| Recommended Weftalis decision | **Reference only.** Trafilatura offers a smaller first extraction surface; reconsider Crawl4AI only after license and browser threat-model review. |

### 6. GPT Researcher

| Field | Evaluation |
| --- | --- |
| Project name | GPT Researcher |
| Source URL | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher), [license](https://github.com/assafelovic/gpt-researcher/blob/master/LICENSE), and [releases](https://github.com/assafelovic/gpt-researcher/releases) |
| Original author or organization | Assaf Elovic and contributors |
| License | Apache-2.0 |
| Platform | Python library/CLI, FastAPI/Next.js application, multi-agent research, pluggable search/scrape/LLM providers |
| Last meaningful maintenance signal | **v3.5.0 on 2026-05-28**, including fixes and provider/retriever updates. |
| Workflow category | 1–5 — discovery through cited report drafting |
| Network access | Yes — search, scraping, LLM, embeddings, optional images, telemetry, and MCP retrievers. |
| Code execution | Yes — Python application and multi-agent orchestration; optional runtime/provider integrations enlarge the surface. |
| Credential requirements | Usually required for an LLM and at least one search/retrieval provider; optional integrations add more. |
| External side effects | Report/image/file writes, optional tracing, persistent report history, and provider usage/cost. |
| Human review support | Partial user interaction, but no mandatory approval before a report is accepted or written. |
| Provenance quality | High. |
| Adaptation effort | High — decompose into source selection, evidence review, brief, and draft rather than porting the agent. |
| Security concerns | Prompt injection, source/citation errors, broad provider data transfer, credential sprawl, cost, dynamic integrations, persistent history, and generated-image provenance. |
| Recommended Weftalis decision | **Admissible after adaptation.** Use its research-plan and citation pattern as evidence, not its full autonomous runtime. |

### 7. STORM / Co-STORM

| Field | Evaluation |
| --- | --- |
| Project name | STORM (Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking) and Co-STORM |
| Source URL | [stanford-oval/storm](https://github.com/stanford-oval/storm), [license](https://github.com/stanford-oval/storm/blob/main/LICENSE), and [Stanford research preview](https://storm.genie.stanford.edu/) |
| Original author or organization | Stanford Open Virtual Assistant Lab |
| License | MIT for repository code; referenced datasets and retrieved content retain their own terms, including CC BY-SA for FreshWiki. |
| Platform | Python package, retrieval/search integrations, LLM/embedding providers, optional Streamlit demo |
| Last meaningful maintenance signal | Official repository news records **knowledge-storm v1.1.0 in 2025-01**; no newer maintainer release was verified. |
| Workflow category | 1, 3, 4, 5, and 8 — research, perspective-driven questions/outlines, drafting, and collaborative curation |
| Network access | Yes — search engines, model providers, embeddings, and the optional hosted preview. |
| Code execution | Yes — Python application. |
| Credential requirements | Usually required for model and search providers; local/user-document modes can reduce external dependencies. |
| External side effects | Report and cache/file writes; hosted preview states that it collects user inputs and feedback for research. |
| Human review support | Partial to strong in Co-STORM's collaboration loop, but not documented as a mandatory pre-publication approval gate. |
| Provenance quality | High, with institutional ownership, papers, license, and source history. |
| Adaptation effort | High. |
| Security concerns | Prompt injection, weak/biased sources, citation drift, model-provider data transfer, hosted-preview data collection, dataset license mixing, and stale maintenance signal. |
| Recommended Weftalis decision | **Admissible after adaptation.** Strong research-brief design reference; require reviewer-selected evidence and an explicit draft approval. |

### 8. Temporal OpenAI Agents SDK demos

| Field | Evaluation |
| --- | --- |
| Project name | Basic Research Workflow and Multi-Agent Interactive Research Workflow |
| Source URL | [temporal-community/openai-agents-demos](https://github.com/temporal-community/openai-agents-demos) and [commit history](https://github.com/temporal-community/openai-agents-demos/commits/main/) |
| Original author or organization | Temporal Community; repository history identifies the demo maintainers |
| License | MIT |
| Platform | Python, Temporal durable workflows, OpenAI Agents SDK, optional PDF/image generation |
| Last meaningful maintenance signal | Maintainer commits for image/report guidance on **2025-11-23**. |
| Workflow category | 1, 3, 4, 5, 7, and 8 — planned research, cited report, optional hero image/PDF, and clarification loop |
| Network access | Yes — OpenAI API and web search; Temporal can be local or remote. |
| Code execution | Yes — Python workers and activities; optional PDF tooling executes local rendering code. |
| Credential requirements | OpenAI API credential required; remote Temporal or added search providers may require more. |
| External side effects | Writes Markdown/PDF/images, creates durable workflow state, and consumes paid API quota. |
| Human review support | Partial — interactive clarification and pause/resume; no mandatory final approval before output files. |
| Provenance quality | High for this specific repository and workflow code. |
| Adaptation effort | High — reproduce the planner/search/writer boundaries in n8n/Dify and omit Temporal/PDF/image execution initially. |
| Security concerns | Search prompt injection, paid API use, durable retention, local file writes, optional native PDF dependencies, and absence of a final gate. |
| Recommended Weftalis decision | **Admissible after adaptation.** One of the best concrete workflow references, but begin with Markdown and explicit approval only. |

### 9. Vane (formerly Perplexica)

| Field | Evaluation |
| --- | --- |
| Project name | Vane, formerly Perplexica |
| Source URL | [ItzCrazyKns/Vane](https://github.com/ItzCrazyKns/Vane) and [releases](https://github.com/ItzCrazyKns/Vane/releases) |
| Original author or organization | ItzCrazyKns and contributors |
| License | MIT |
| Platform | TypeScript web application, Docker, SearxNG, local or hosted LLM providers |
| Last meaningful maintenance signal | **v1.12.2 on 2026-04-10**. |
| Workflow category | 1–4 — search, discovery/trends, question refinement, and cited answers |
| Network access | Yes — SearxNG/search engines, media search, model providers, and source sites. |
| Code execution | Yes — full web application and search stack. |
| Credential requirements | Optional with local models; required for cloud providers and some search services. |
| External side effects | Stores local search history and uploaded files; makes broad search requests. |
| Human review support | Search UI permits inspection, but no workflow approval checkpoint. |
| Provenance quality | High. |
| Adaptation effort | Very high if treated as an application; medium if only its cited-answer contract is independently modeled. |
| Security concerns | Uploaded-file retention, search privacy, prompt injection, broad network egress, provider keys, local database exposure, and security advisories requiring version review. |
| Recommended Weftalis decision | **Reference only.** The full answering engine is too broad; use only its source-visible answer pattern as comparison evidence. |

### 10. LanguageTool

| Field | Evaluation |
| --- | --- |
| Project name | LanguageTool core |
| Source URL | [languagetool-org/languagetool](https://github.com/languagetool-org/languagetool), [commit history](https://github.com/languagetool-org/languagetool/commits/master/), and [release roadmap](https://dev.languagetool.org/roadmap) |
| Original author or organization | LanguageTool organization and contributors |
| License | LGPL-2.1-or-later for the core; separately bundled data/components must be checked. |
| Platform | Java library, CLI, and self-hostable HTTP grammar/style service |
| Last meaningful maintenance signal | Multiple language-rule commits on **2026-05-29**; the project uses a snapshot-based release model. |
| Workflow category | 6 and 8 — grammar/style suggestions and reviewer-visible diagnostics |
| Network access | No for a local library/server check; yes when a remote LanguageTool API is used. |
| Code execution | Yes — Java service/library; it does not need arbitrary user script execution. |
| Credential requirements | None for self-hosted core; remote/commercial services may require credentials. |
| External side effects | Diagnostics only by default; a caller may apply replacements or store text. |
| Human review support | Partial — suggestions are naturally reviewable, but the caller must require accept/reject. |
| Provenance quality | High for core; verify language data and premium/service boundaries separately. |
| Adaptation effort | High for local bundling; medium for a reviewed API dependency. |
| Security concerns | Sensitive draft transfer to a remote API, large Java service surface, LGPL redistribution obligations, language-data licenses, and overconfident auto-fixes. |
| Recommended Weftalis decision | **Admissible after adaptation.** Return suggestions as annotations and require human acceptance; never auto-rewrite the approved draft. |

### 11. textlint

| Field | Evaluation |
| --- | --- |
| Project name | textlint core |
| Source URL | [textlint/textlint](https://github.com/textlint/textlint) and [official site](https://textlint.org/) |
| Original author or organization | azu and textlint contributors |
| License | MIT for core; every selected rule/plugin has its own license and provenance. |
| Platform | Node.js/TypeScript CLI and plugin framework for Markdown/plain text |
| Last meaningful maintenance signal | Repository organization showed core updates on **2026-05-28**. |
| Workflow category | 6 and 8 — configurable prose/style checks and reviewer diagnostics |
| Network access | No for a fully local pinned rule set after dependencies are present. |
| Code execution | Yes — Node.js plus third-party rule/plugin code. |
| Credential requirements | None for local rules. |
| External side effects | Diagnostics; optional fix mode can modify files. |
| Human review support | Partial — lint output supports review, but fix mode must be disabled or gated. |
| Provenance quality | High for core; variable for rules/plugins. |
| Adaptation effort | Medium with a very small audited rule set; high with community plugins. |
| Security concerns | npm/plugin supply chain, arbitrary plugin code, incompatible rule licenses, destructive auto-fix, and rule bias or language limits. |
| Recommended Weftalis decision | **Admissible after adaptation.** Pin core plus a tiny separately reviewed rule set and expose findings, not automatic edits. |

### 12. Vale

| Field | Evaluation |
| --- | --- |
| Project name | Vale |
| Source URL | [vale-cli/vale](https://github.com/vale-cli/vale), [releases](https://github.com/vale-cli/vale/releases), and [official documentation](https://vale.sh/) |
| Original author or organization | Joseph Kato and Vale contributors |
| License | MIT for Vale core; style packages and vocabularies require separate review. |
| Platform | Go CLI for markup-aware prose linting with declarative style rules |
| Last meaningful maintenance signal | **v3.15.1 on 2026-06-12**, verified during Phase 11B1. Audit note: Phase 11A originally observed **v3.14.2 on 2026-05-15**; the original observation is retained here for traceability. |
| Workflow category | 6 and 8 — voice/style conformance checks and human review evidence |
| Network access | No with local pinned styles; optional package synchronization uses the network. |
| Code execution | Yes — compiled CLI, but style rules are primarily declarative rather than general-purpose scripts. |
| Credential requirements | None for local use. |
| External side effects | Diagnostics only; caller controls any file changes. |
| Human review support | Partial to strong as a pre-approval quality report, but Vale itself does not pause a workflow. |
| Provenance quality | High for core; style-package provenance varies. |
| Adaptation effort | Medium. |
| Security concerns | Style-package supply chain/licensing, accidental remote sync, false positives, unsupported language/markup edge cases, and treating lint success as editorial approval. |
| Recommended Weftalis decision | **Admissible after adaptation.** Best first deterministic style-gate reference; pin local rules and keep human editorial control. |

### 13. Satori

| Field | Evaluation |
| --- | --- |
| Project name | Satori |
| Source URL | [vercel/satori](https://github.com/vercel/satori) and [releases](https://github.com/vercel/satori/releases) |
| Original author or organization | Shu Ding and Vercel contributors |
| License | MPL-2.0 |
| Platform | TypeScript/JavaScript library with bundled WASM; converts constrained HTML/CSS/JSX to SVG |
| Last meaningful maintenance signal | **0.27.0 on 2026-04-30**. |
| Workflow category | 7 and 8 — deterministic social/Open Graph card rendering and visual review |
| Network access | Optional for remote fonts/images/WASM; can use reviewed local assets instead. |
| Code execution | Yes — JavaScript/WASM rendering library. |
| Credential requirements | None when all assets are local; remote asset hosts may have their own access controls. |
| External side effects | Returns SVG; PNG conversion or filesystem writes require a separate caller/tool. |
| Human review support | None internally; generated cards are easy to place before a visual approval gate. |
| Provenance quality | High. |
| Adaptation effort | High for current n8n/Dify support because a controlled renderer dependency is required. |
| Security concerns | Untrusted JSX/style input, remote asset tracking/SSRF, font and image rights, SVG injection, resource exhaustion, MPL file-level obligations, and rasterization dependencies. |
| Recommended Weftalis decision | **Admissible after adaptation.** Use fixed templates and local licensed assets, output a preview, and require human approval; do not publish automatically. |

### 14. Formbricks

| Field | Evaluation |
| --- | --- |
| Project name | Formbricks core |
| Source URL | [formbricks/formbricks](https://github.com/formbricks/formbricks), [license](https://github.com/formbricks/formbricks/blob/main/LICENSE), and [releases](https://github.com/formbricks/formbricks/releases) |
| Original author or organization | Formbricks GmbH and contributors |
| License | AGPL-3.0 for the core; enterprise components have separate terms. |
| Platform | TypeScript/Next.js survey and experience-management application with API and database |
| Last meaningful maintenance signal | **5.0.1 on 2026-05-27**. |
| Workflow category | 8 and 9 — human feedback collection, survey responses, and analysis inputs |
| Network access | Yes — survey delivery, API, email/integrations, and optional hosted service. |
| Code execution | Yes — full web application and worker stack. |
| Credential requirements | Required for administration/API/integrations; public survey respondents may not authenticate. |
| External side effects | Creates surveys, sends invitations depending on configuration, and stores personal response data. |
| Human review support | Strong for human response collection and analyst review; not a generic workflow approval gate. |
| Provenance quality | High for core. |
| Adaptation effort | High for an API-only response-ingestion workflow; very high to self-host or copy code. |
| Security concerns | Consent, personal data, retention/deletion, access control, spam/abuse, email side effects, tenancy, enterprise/core boundary, and AGPL obligations. |
| Recommended Weftalis decision | **Admissible after adaptation, later batch.** Only ingest a minimal redacted response export after explicit consent; do not add a database or account system to Weftalis. |

### 15. HumanLayer

| Field | Evaluation |
| --- | --- |
| Project name | HumanLayer repository, including its human-approval SDK lineage |
| Source URL | [humanlayer/humanlayer](https://github.com/humanlayer/humanlayer), [license](https://github.com/humanlayer/humanlayer/blob/main/LICENSE), and [releases](https://github.com/humanlayer/humanlayer/releases) |
| Original author or organization | HumanLayer, Inc. and contributors |
| License | Apache-2.0 for the HumanLayer SDK and CodeLayer sources identified by the repository. |
| Platform | Current desktop/CLI coding-agent product plus SDK history across local and networked components |
| Last meaningful maintenance signal | **codelayer-0.20.0 on 2025-12-23**. |
| Workflow category | 8 — durable human decisions around agent actions |
| Network access | Yes for model/provider and remote approval channels; exact needs vary by component. |
| Code execution | Yes, especially in the current coding-agent focus. |
| Credential requirements | Usually required for model providers and any remote messaging/approval channel. |
| External side effects | Approval requests, messages, agent state, and potentially code/file changes. |
| Human review support | Explicit by design in the SDK lineage. |
| Provenance quality | High for repository ownership; medium for fit because the project focus has shifted. |
| Adaptation effort | Very high for code reuse; medium to independently reproduce its approve/reject/timeout state model. |
| Security concerns | Approval spoofing, stale approvals, identity/channel authentication, sensitive prompt leakage, code-agent privileges, and confusing approval with safety. |
| Recommended Weftalis decision | **Reference only.** Use its decision-state concepts, not its current broad coding-agent runtime. |

### 16. Langfuse

| Field | Evaluation |
| --- | --- |
| Project name | Langfuse core |
| Source URL | [langfuse/langfuse](https://github.com/langfuse/langfuse), [license](https://github.com/langfuse/langfuse/blob/main/LICENSE), and [releases](https://github.com/langfuse/langfuse/releases) |
| Original author or organization | Langfuse GmbH and contributors |
| License | MIT except `ee` folders, which are not covered by the core MIT grant. |
| Platform | TypeScript web/worker stack, ClickHouse and other storage, APIs/SDKs, self-hosted or cloud |
| Last meaningful maintenance signal | **v3.185.0 on 2026-06-12**. |
| Workflow category | 8 and 9 — trace review, comments, scores, annotation queues, datasets, and evaluations |
| Network access | Yes — telemetry ingestion, APIs, model integrations, storage, and optional cloud deployment. |
| Code execution | Yes — application/workers; newer code-based evaluators add a separate execution surface. |
| Credential requirements | Required for API ingestion and administration. |
| External side effects | Stores detailed prompts, outputs, traces, comments, media, scores, and user/project data. |
| Human review support | Strong annotation and scoring support, but not a content publication approval gate. |
| Provenance quality | High for core, with an explicit enterprise-folder exception. |
| Adaptation effort | Very high to operate; high for a minimal API integration. |
| Security concerns | Sensitive trace retention, multi-user access, database/accounts outside current scope, code evaluators, API keys, enterprise/core license boundary, and analytics egress. |
| Recommended Weftalis decision | **Reference only.** The annotation model is useful, but the platform is far beyond a first Workflow Package and current Weftalis scope. |

### 17. Opik

| Field | Evaluation |
| --- | --- |
| Project name | Opik |
| Source URL | [comet-ml/opik](https://github.com/comet-ml/opik), [license](https://github.com/comet-ml/opik/blob/main/LICENSE), and [releases](https://github.com/comet-ml/opik/releases) |
| Original author or organization | Comet ML, Inc. and contributors |
| License | Apache-2.0 |
| Platform | Multi-language SDKs plus self-hosted web/backend/database stack for LLM tracing and evaluation |
| Last meaningful maintenance signal | **2.0.49 on 2026-05-27**. |
| Workflow category | 8 and 9 — feedback scores, evaluation, monitoring, and dashboards |
| Network access | Yes — trace/evaluation ingestion, APIs, model evaluators, and optional hosted service. |
| Code execution | Yes — application workers and automated evaluation code. |
| Credential requirements | Required for hosted/API use; self-hosted administration also requires protected access. |
| External side effects | Stores traces, prompts, outputs, feedback scores, datasets, and dashboards. |
| Human review support | Partial to strong for scoring and inspection; not a generic pre-publication approval. |
| Provenance quality | High. |
| Adaptation effort | Very high for the platform; high for a minimal feedback export/analysis integration. |
| Security concerns | Sensitive prompt/output retention, evaluator code, model-provider egress, account/database scope, access control, and confusing observed quality with safety. |
| Recommended Weftalis decision | **Reference only.** Prefer a small, explicit feedback schema before integrating an observability platform. |

### 18. n8n Self-hosted AI Starter Kit demo workflow

| Field | Evaluation |
| --- | --- |
| Project name | Self-hosted AI Starter Kit — `Demo workflow` |
| Source URL | [n8n-io/self-hosted-ai-starter-kit](https://github.com/n8n-io/self-hosted-ai-starter-kit) and the [n8n JSON export](https://github.com/n8n-io/self-hosted-ai-starter-kit/blob/main/n8n/demo-data/workflows/srOnR8PAY3u4RSwb.json) |
| Original author or organization | n8n GmbH / n8n-io |
| License | Apache-2.0 for the starter-kit repository; n8n itself and bundled services retain their own licenses. |
| Platform | n8n JSON export using Chat Trigger, Basic LLM Chain, and a local Ollama credential reference |
| Last meaningful maintenance signal | Repository push on **2026-01-06**; the demo export itself records no update after **2024-02-23**. |
| Workflow category | 5 only in the broadest sense — generic LLM response generation, not a content workflow |
| Network access | Yes to a local Ollama service endpoint; not necessarily public internet. |
| Code execution | No Code or shell node is visible in the reviewed three-node export. |
| Credential requirements | A named local Ollama credential reference is present; no credential value is visible. |
| External side effects | Chat response only; surrounding Docker stack creates persistent database/vector-store state. |
| Human review support | None. |
| Provenance quality | High. |
| Adaptation effort | Low technically, but high conceptual effort to become relevant and reviewed. |
| Security concerns | Stale node versions, credential metadata, broad surrounding stack, no review gate, and no content provenance. |
| Recommended Weftalis decision | **Reference only.** It proves a well-provenanced n8n export can exist, but it is too generic to justify a content-package import. |

### 19. Agent Laboratory

| Field | Evaluation |
| --- | --- |
| Project name | Agent Laboratory and AgentRxiv integration |
| Source URL | [SamuelSchmidgall/AgentLaboratory](https://github.com/SamuelSchmidgall/AgentLaboratory) and [commit history](https://github.com/SamuelSchmidgall/AgentLaboratory/commits/main/) |
| Original author or organization | Samuel Schmidgall and named research collaborators |
| License | MIT for source code, as stated by the repository. |
| Platform | Python multi-agent scientific workflow with arXiv, Hugging Face, Python experimentation, and optional LaTeX compilation |
| Last meaningful maintenance signal | Maintainer announcement for AgentRxiv on **2025-03-24**; newer 2026 issues show interest but not verified maintenance. |
| Workflow category | 1, 3, 4, 5, and 8 — research through autonomous experiments and reports |
| Network access | Yes — papers, datasets/models, LLM providers, and AgentRxiv. |
| Code execution | Yes, intentionally — Python experiments and optional LaTeX/PDF compilation. |
| Credential requirements | Required for supported hosted LLMs and potentially Hugging Face/other services. |
| External side effects | Downloads data/models, runs experiments, writes checkpoints/reports, and can upload/retrieve AgentRxiv research. |
| Human review support | Optional co-pilot mode, but autonomous mode is central and external effects are not bounded by a content approval gate. |
| Provenance quality | High for the repository and paper. |
| Adaptation effort | Very high; removing experimentation and autonomous sharing would remove its defining behavior. |
| Security concerns | Arbitrary generated code, data/model supply chain, expensive compute, credential exposure, untrusted papers/prompts, file writes, LaTeX execution, and autonomous upload. |
| Recommended Weftalis decision | **Reject for this content pipeline.** The relevant report-writing ideas are already available from narrower candidates without autonomous experimentation or research sharing. |

## Screened out before full mapping

These sources were found during the required search for existing projects but
were not admitted to the candidate map because license or per-workflow provenance
could not be established strongly enough.

| Screened source | Decision | Reason |
| --- | --- | --- |
| [crewAIInc/crewAI-examples](https://github.com/crewAIInc/crewAI-examples) | Reject | Archived on 2026-04-20; repository explicitly says to check individual examples for licenses, so a repository-wide reuse grant was not established for the Content Creator Flow. |
| [svcvit/Awesome-Dify-Workflow](https://github.com/svcvit/Awesome-Dify-Workflow) | Reject | Repository is MIT, but its own table gives missing or informal provenance for multiple contributed DSL files; repository license alone does not prove rights to every workflow/prompt. |
| [nusquama/n8nworkflows.xyz](https://github.com/nusquama/n8nworkflows.xyz) and similar n8n gallery archives | Reject | Archive code/structure may be MIT, while thousands of copied workflows retain unspecified individual licenses and pseudonymous `user_*` metadata; bulk availability is not provenance. |

The screened sources may help discover an original author page later, but no file
from them should be copied or imported unless the exact upstream workflow,
author, license, and version are independently verified.

## Cross-cutting findings and uncertainties

- **No direct import passed.** Clear platform compatibility was not enough when a
  workflow lacked per-item license, provenance, bounded permissions, or a real
  approval checkpoint.
- **Human interaction is not always approval.** Clarifying questions, annotation
  queues, surveys, and editable reports are helpful but do not automatically
  create a blocking pre-publication gate.
- **Open-source core does not cover every component.** Rule packs, datasets,
  fonts, templates, enterprise folders, hosted services, and retrieved content
  may have different terms.
- **Copyleft is not rejection by itself.** RSSHub and Formbricks can remain
  external dependencies, but copying their code into an Apache-licensed package
  requires explicit compatibility review.
- **Maintenance dates are snapshots.** Recheck releases, ownership, archived
  status, security advisories, and licenses at the exact commit chosen later.
- **Source legality is unresolved.** RSS, scraping, search results, and generated
  summaries can implicate site terms, copyright, robots rules, personal data,
  and regional law. This map is not legal advice.
- **Security remains unproven.** Static documentation review cannot detect hidden
  behavior, compromised dependencies, runtime-only downloads, prompt injection,
  inaccurate permission declarations, or whether a workflow actually runs.
