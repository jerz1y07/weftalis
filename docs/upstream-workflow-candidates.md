# Upstream Workflow Artifact Candidates

## Scope and admission boundary

This Phase 11B1 correction pass examines repositories that contain identifiable
Workflow artifacts. It does not import, execute, or package any candidate.
Research used repository files and GitHub file history at the pinned commits on
2026-07-21.

A candidate may enter the main Weftalis Registry only when an identifiable
upstream Workflow artifact already exists and its exact repository, file path,
author, license, and pinned revision can be documented. A tool alone is not an
admissible Workflow. Any future adaptation must faithfully preserve the existing
Workflow logic and document every transformation.

“Complete” below means that the upstream artifact contains an apparent end-to-end
graph or Workflow implementation. It is not a runtime-test, safety, compatibility,
or production-readiness claim.

## 1. Dify JSON Repair

- **Workflow name:** `json-repair`
- **Upstream repository:** [svcvit/Awesome-Dify-Workflow](https://github.com/svcvit/Awesome-Dify-Workflow)
- **Exact Workflow file path:** [`DSL/json-repair.yml`](https://github.com/svcvit/Awesome-Dify-Workflow/blob/e730ed3627e5fa56fc1668d995b83178b6b1181c/DSL/json-repair.yml)
- **Workflow format:** Dify DSL YAML, app version `0.1.2`, Workflow mode
- **Original author/source attribution:** Repository publisher, introducing commit identity, and the pinned README's source attribution are all `svcvit`; the file was introduced in commit `13fc5335b625a2bf8dc29002a10e03a356ffce75`. The legal personal identity and independent originality are not established by GitHub metadata alone.
- **License:** Repository [MIT license](https://github.com/svcvit/Awesome-Dify-Workflow/blob/e730ed3627e5fa56fc1668d995b83178b6b1181c/LICENSE), copyright 2024 `svcvit`. The file has no per-file SPDX header; the completed [artifact audit](json-repair-artifact-audit.md) records the remaining provenance limits.
- **Pinned tag or commit:** `e730ed3627e5fa56fc1668d995b83178b6b1181c`
- **Platform:** Dify
- **What it does:** Accepts malformed JSON, runs a Dify Python Code node that calls `json_repair.repair_json`, and returns the resulting string through a three-node start → code → end graph.
- **Complete or example:** Complete minimal example; upstream does not establish production or current-version runtime verification.
- **Required credentials and permissions:** No declared credential, model, or Workflow network requirement. Dify Code-node execution and the separately installed `json_repair` Python package are required; the Workflow does not pin the package version, and input must be treated as untrusted.
- **External side effects:** None visible in the static graph beyond normal Dify execution records.
- **Modification needed for Weftalis:** Preserve the 3,244-byte upstream YAML unchanged with SHA-256 `5859d8c833593069cfe781da27d585a24cdbbf5e03a50af56b2ae01045d491ad`. Add separate provenance, input/output, dependency, Code-node risk, and runtime-untested documentation; do not normalize or reserialize the Workflow file.
- **Recommended decision:** **Admissible without functional modification, pending human approval.** The [import plan](json-repair-import-plan.md) keeps the upstream bytes authoritative and records unresolved license, dependency-version, Dify-compatibility, and runtime questions.

## 2. n8n Self-hosted AI Starter Kit Demo Workflow

- **Workflow name:** `Demo workflow`
- **Upstream repository:** [n8n-io/self-hosted-ai-starter-kit](https://github.com/n8n-io/self-hosted-ai-starter-kit)
- **Exact Workflow file path:** [`n8n/demo-data/workflows/srOnR8PAY3u4RSwb.json`](https://github.com/n8n-io/self-hosted-ai-starter-kit/blob/9b802c62c609dedae5869ab2dfaf4a25daf817a1/n8n/demo-data/workflows/srOnR8PAY3u4RSwb.json)
- **Workflow format:** n8n JSON export
- **Original author:** `jeanpaul`; file history shows that identity created and later updated the Workflow in the n8n-owned repository
- **License:** [Apache-2.0](https://github.com/n8n-io/self-hosted-ai-starter-kit/blob/9b802c62c609dedae5869ab2dfaf4a25daf817a1/LICENSE)
- **Pinned tag or commit:** no release tag; repository pinned to `9b802c62c609dedae5869ab2dfaf4a25daf817a1`
- **Platform:** n8n with LangChain community nodes and local Ollama
- **What it does:** Connects a chat trigger to a basic LLM chain backed by the `llama3.2:latest` Ollama chat model.
- **Complete or example:** Explicit upstream demo/example, inactive in the export. The upstream README says the starter kit is for getting started and is not fully optimized for production.
- **Required credentials and permissions:** Ollama API credential metadata is present; network access to the operator's Ollama service and an n8n chat webhook are required. The model name is floating rather than digest-pinned.
- **External side effects:** Receives and returns chat content; n8n/Ollama may retain execution or model-request data according to deployment configuration. No file, email, database, or publishing node appears in the three-node graph.
- **Modification needed for Weftalis:** Remove exported credential ID/name and instance-specific metadata while preserving chat trigger → chain → Ollama logic. Document the floating model dependency and do not silently replace it with another provider or model.
- **Recommended decision:** **Priority artifact review — admissible only after faithful redaction.** Strong official provenance, but it must remain labeled an untested demo rather than a ready-to-run production Workflow.

## 3. News Aggregation with Deduplication and Ranking

- **Workflow name:** `News Aggregation with Deduplication and Ranking`
- **Upstream repository:** [splinesreticulating/n8n-v2-workflow-skill](https://github.com/splinesreticulating/n8n-v2-workflow-skill)
- **Exact Workflow file path:** [`assets/examples/news-aggregation-workflow.json`](https://github.com/splinesreticulating/n8n-v2-workflow-skill/blob/311102d5911e6d2423413b12ad8a55d1cd6ec828/assets/examples/news-aggregation-workflow.json)
- **Workflow format:** n8n v2 JSON example
- **Original author:** `nbp` / GitHub identity `splinesreticulating`; the file has a single introducing commit
- **License:** [MIT](https://github.com/splinesreticulating/n8n-v2-workflow-skill/blob/311102d5911e6d2423413b12ad8a55d1cd6ec828/LICENSE)
- **Pinned tag or commit:** `311102d5911e6d2423413b12ad8a55d1cd6ec828`
- **Platform:** n8n v2
- **What it does:** Manually fetches AI news from NewsAPI and the n8n blog RSS feed, normalizes both sources, merges them, deduplicates by URL, scores four fixed keywords plus recency, and returns the top ten.
- **Complete or example:** Complete eight-node example. It declares HTTP Header Auth for NewsAPI but requires operator credential configuration; no runtime claim was checked.
- **Required credentials and permissions:** NewsAPI HTTP-header credential; outbound network access to `newsapi.org` and `blog.n8n.io`; JavaScript-capable Code nodes for deduplication and ranking.
- **External side effects:** Read-only requests to two external sources and normal n8n execution retention; no publishing, messaging, or storage node appears.
- **Modification needed for Weftalis:** Remove any exported credential reference if present, document fixed sources/keywords, and preserve the fetch → normalize → merge → deduplicate → rank logic. Parameterization is acceptable only when mapped explicitly to the original constants.
- **Recommended decision:** **Secondary artifact review — admissible after faithful adaptation.** Provenance is clear and the graph is bounded, but external-source terms, authentication, Code-node behavior, and n8n v2 compatibility need review.

## 4. Sales Analyst

- **Workflow name:** `sales analyst`
- **Upstream repository:** [apache2op/n8n-agents](https://github.com/apache2op/n8n-agents)
- **Exact Workflow file path:** [`sales data analyst/sales data analyst.json`](https://github.com/apache2op/n8n-agents/blob/568b435764532149d46284c6b35a00e77a307992/sales%20data%20analyst/sales%20data%20analyst.json)
- **Workflow format:** n8n JSON export
- **Original author:** Ayush Das / GitHub identity `apache2op`; the file has one introducing commit
- **License:** [MIT](https://github.com/apache2op/n8n-agents/blob/568b435764532149d46284c6b35a00e77a307992/LICENSE)
- **Pinned tag or commit:** `568b435764532149d46284c6b35a00e77a307992`
- **Platform:** n8n with LangChain community nodes
- **What it does:** A chat-triggered AI agent uses an OpenRouter model, short-term memory, and a Google Sheets tool to answer questions about sales data.
- **Complete or example:** Importable five-node example, inactive in the export. Runtime completeness was not verified.
- **Required credentials and permissions:** OpenRouter API and Google Sheets OAuth credentials; model-provider and Google network access; chat webhook; the agent can decide when to call the Sheets tool.
- **External side effects:** Sends prompts/context to OpenRouter and accesses a hard-coded Google Sheet. The exact operation boundary of the Sheets tool needs manual confirmation before it can be described as read-only.
- **Modification needed for Weftalis:** Remove exported credential IDs/names and the hard-coded Google Sheet URL/cached metadata, replacing them with declared operator configuration while preserving the agent/model/memory/Sheets-tool graph and tool purpose. Every replacement must be documented.
- **Recommended decision:** **Hold for deeper artifact review.** It is a real authored Workflow with a clear license, but hard-coded third-party resource identifiers and an agent-controlled data tool require careful permission analysis.

## 5. Interactive Research Workflow

- **Workflow name:** `InteractiveResearchWorkflow`
- **Upstream repository:** [temporal-community/openai-agents-demos](https://github.com/temporal-community/openai-agents-demos)
- **Exact Workflow file path:** [`openai_agents/workflows/interactive_research_workflow.py`](https://github.com/temporal-community/openai-agents-demos/blob/ee5f871b48cb26ec28239ef7a4719ab10c4903e8/openai_agents/workflows/interactive_research_workflow.py)
- **Workflow format:** Python Temporal Workflow definition with supporting activity and agent modules
- **Original author:** Steve Androulakis / GitHub identity `steveandroulakis`; file history shows the same author created and maintained it
- **License:** [MIT](https://github.com/temporal-community/openai-agents-demos/blob/ee5f871b48cb26ec28239ef7a4719ab10c4903e8/LICENSE)
- **Pinned tag or commit:** `ee5f871b48cb26ec28239ef7a4719ab10c4903e8`
- **Platform:** Temporal Python SDK plus OpenAI Agents SDK
- **What it does:** Runs a long-lived research flow with an initial query, optional clarification questions, status queries and updates, research agents, report generation, and a user-controlled end signal.
- **Complete or example:** Complete upstream demo spanning multiple Python files; the named file is the orchestration entry point, not a standalone single-file package.
- **Required credentials and permissions:** OpenAI API access, Temporal server/worker, Python code execution, network search/model access, and supporting PDF/image-generation activities depending on the selected path.
- **External side effects:** Model/search requests and report/PDF file generation; execution state is persisted by Temporal. No mandatory final publication gate was identified.
- **Modification needed for Weftalis:** Current n8n/Dify package support cannot faithfully represent this Workflow without major redesign. A future platform adapter would have to preserve Temporal signals, updates, durable waiting, agent sequence, and outputs across all supporting files.
- **Recommended decision:** **Reference only.** This is a real upstream Workflow, but converting it now would be a new implementation rather than a demonstrably faithful transformation.

## 6. Leave Request: Auto Fetch & Process

- **Workflow name:** `Leave Request: Auto Fetch & Process (v1)`
- **Upstream repository:** [NiiOsa1/n8n-automation](https://github.com/NiiOsa1/n8n-automation)
- **Exact Workflow file path:** [`workflows/leave-request.json`](https://github.com/NiiOsa1/n8n-automation/blob/e14f51dca7b291899bcdc7274c9a3d2b52f0ec38/workflows/leave-request.json)
- **Workflow format:** n8n JSON export
- **Original author:** Repository maintainer Michael Mensah Ofeor (`NiiOsa1`); the file commit records the local author name `Ubuntu`, so file authorship needs human confirmation
- **License:** [MIT](https://github.com/NiiOsa1/n8n-automation/blob/e14f51dca7b291899bcdc7274c9a3d2b52f0ec38/LICENSE)
- **Pinned tag or commit:** `e14f51dca7b291899bcdc7274c9a3d2b52f0ec38`
- **Platform:** self-hosted n8n with PocketBase, Microsoft Graph/Outlook, and OpenAI nodes
- **What it does:** Processes leave requests from webhooks and email, validates and classifies requests, checks conflicts and balances, asks managers for approval/rejection, updates PocketBase, and notifies employees.
- **Complete or example:** Large 90-node application Workflow exported as active. It is environment-specific rather than a portable template.
- **Required credentials and permissions:** Microsoft Outlook OAuth, OpenAI API, HTTP Basic Auth, PocketBase administrator authentication, public webhooks, scheduled mailbox access, code execution, and extensive network/data access.
- **External side effects:** Sends emails, marks source emails read, creates and patches leave/employee records, returns webhook responses, and changes business approval state. Hard-coded organization email/resource identifiers are present.
- **Modification needed for Weftalis:** Safe reuse would require extensive identifier removal, credential-boundary redesign, endpoint replacement, inactive-by-default handling, and side-effect gates. Those changes risk altering the defining Workflow logic.
- **Recommended decision:** **Reject for the first import batch.** The artifact is real and licensed, but its active state, sensitive business data, hard-coded identifiers, administrator access, and irreversible side effects are too broad for a faithful low-risk pilot.

## 7. Sentiment Analysis

- **Workflow name:** `Sentiment Analysis`
- **Upstream repository:** [YOUHAD08/N8N](https://github.com/YOUHAD08/N8N)
- **Exact Workflow file path:** [`Sentiment Analysis/Sentiment Analysis.json`](https://github.com/YOUHAD08/N8N/blob/e246d5ddfd7376986222681194df7ae5acf088e6/Sentiment%20Analysis/Sentiment%20Analysis.json)
- **Workflow format:** n8n JSON export
- **Original author:** Ayoub Youhad / GitHub identity `YOUHAD08`; the file has one introducing commit
- **License:** **Undetermined for admission.** The README states MIT, but GitHub repository metadata and the pinned tree expose no `LICENSE` file. A README statement alone is insufficient evidence for redistribution terms.
- **Pinned tag or commit:** `e246d5ddfd7376986222681194df7ae5acf088e6`
- **Platform:** n8n with LangChain community nodes
- **What it does:** Accepts a form submission, sends text through an OpenAI-backed LLM chain for sentiment analysis, merges results, and appends or updates a Google Sheets row.
- **Complete or example:** Upstream describes the collection as production-ready, but this file remains an untested example for Weftalis review.
- **Required credentials and permissions:** OpenAI API and Google Sheets OAuth credentials; public form endpoint; outbound model and Google API network access.
- **External side effects:** Sends submitted content to OpenAI and writes or updates spreadsheet data.
- **Modification needed for Weftalis:** Credential and document identifiers would need redaction and the external write would need an explicit human gate, while preserving form → model → merge → Sheets-write logic.
- **Recommended decision:** **Reject until license evidence is cured.** The real Workflow artifact satisfies the path and author tests but fails the license gate.

## Artifact-level shortlist

1. **Dify JSON Repair** — smallest supported-format artifact; priority legal and Code-node review.
2. **n8n Self-hosted AI Starter Kit Demo Workflow** — strongest organizational provenance; preserve its explicit demo status.
3. **News Aggregation with Deduplication and Ranking** — bounded, readable graph; requires external-source and Code-node review.
4. **Sales Analyst** — real authored export, but hold until hard-coded Sheet/credential metadata and tool permissions are resolved.

The Temporal research Workflow remains reference-only because its platform cannot
currently be transformed faithfully. The leave-request Workflow is too broad and
side-effectful for a pilot. Sentiment Analysis is blocked by missing license-file
evidence. None of these decisions authorizes package creation.
