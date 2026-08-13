# Weft Place Brand and Public Content Specification

Status: **authoritative for the first public implementation**

Phase: **B0B — Brand Decision & Content Model Freeze**

Public language: **English only**

This specification supersedes earlier public-facing Weftalis naming, tagline,
visual, and content guidance. Existing repository names, URLs, schema IDs,
package IDs, and other technical identifiers remain unchanged until a separate
implementation decision explicitly changes them.

Core UX principle: **Strict underneath, simple on the surface.**

## 1. Brand naming and wordmark

- The public product name is **Weft Place**.
- In prose, metadata, accessible names, and spoken references, write
  **Weft Place** in title case.
- The wordmark may render the words as **WEFT PLACE**. **WEFT** must be visually
  dominant; **PLACE** must be lighter and secondary. Keep both words readable.
- Use a text wordmark in Source Sans 3 for the first implementation. Do not
  invent a separate symbol or hide either word in a decorative mark.
- The accessible name of the wordmark is `Weft Place`.
- `Weftalis` and `weftalis` are legacy technical identifiers, not alternative
  public product names. Preserve them where required by the repository name,
  GitHub Pages path, package name, schema ID, source path, or other established
  identifier.

## 2. Tagline

The official tagline is:

> The place for open AI workflows.

Do not substitute the legacy tagline or add unsupported qualifiers such as
“verified,” “safe,” or “production-ready.”

## 3. Visual direction

The direction is **Editorial Infrastructure**, approximately:

- 55% Silver Infrastructure: clear structure, precise alignment, restrained
  rules, dependable states, and generous white space;
- 40% Editorial Marketplace: useful titles, concise summaries, strong reading
  order, and selective curation; and
- 5% Woven Identity: a subtle line, crossing, or rhythm that suggests weaving
  without becoming a network graphic.

These percentages express emphasis, not per-page layout quotas. Prefer flat
planes and typographic hierarchy over repeated cards. Do not use AI gradients,
glowing networks, robot imagery, badge walls, excessive card surfaces, or the
current green as a dominant brand color.

## 4. Initial color tokens

These tokens are the first implementation palette. Additional shades require a
specific accessibility or component need.

| Token | Value | Intended use |
| --- | --- | --- |
| `--wp-color-white` | `#FFFFFF` | Main canvas and inverse text |
| `--wp-color-pearl` | `#F7F6F2` | Quiet editorial background |
| `--wp-color-silver-100` | `#ECEEF0` | Subtle fills and separators |
| `--wp-color-silver-300` | `#C8CDD2` | Borders and inactive structure |
| `--wp-color-silver-600` | `#70777F` | Secondary graphic detail, not small body text |
| `--wp-color-graphite` | `#202428` | Primary text and dark surfaces |
| `--wp-color-graphite-muted` | `#545B62` | Secondary text |
| `--wp-color-steel-blue` | `#356A8A` | Links and accessible interactive focus |

Use graphite for meaning and hierarchy. Steel-blue is a restrained interaction
color, not a decorative brand wash. Status must never be communicated by color
alone.

## 5. Typography

- Primary public typeface: **Source Sans 3**.
- First-phase fallback stack:
  `"Source Sans 3", "Helvetica Neue", Arial, sans-serif`.
- Do not introduce Source Serif 4 in the first implementation.
- Technical values only may use:
  `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- Use weight, size, spacing, and rules to establish hierarchy. Avoid decorative
  display typography and excessive all-caps text outside the wordmark.

## 6. Public navigation

The wordmark links to Home. Primary navigation is:

1. `Workflows`
2. `Collections`, only while at least one real, relevant collection exists
3. `Submit workflow`

The Weft Place repository belongs in secondary navigation or the footer and
uses the label `Project source`. Reserve `View source` for the exact upstream
source of a workflow. Do not show disabled or enabled-looking navigation for an
unavailable destination.

## 7. Homepage information hierarchy

Present public information in this order:

1. **What is this?** Product name, official tagline, and one plain sentence
   describing an open place to find AI workflow artifacts.
2. **What does it do?** Explain that people can browse workflows, understand
   their purpose, and follow the available acquisition path.
3. **Who made it?** Identify original creators and sources on actual workflow
   examples; identify Weft Place as the listing service, not the author of all
   workflows.
4. **How do I get or use it?** Lead to real workflow listings. Never present a
   disabled search box or unusable action as a feature preview.
5. **What important limitation should I know?** State that listing is not proof
   of safety, compatibility, executability, production readiness, or quality,
   and that Weft Place does not necessarily run listed workflows.
6. **Technical evidence only when requested.** Link to detail pages; do not lead
   with schema, validation, permissions, versions, or hashes.

Use real workflows only. Do not fabricate breadth, adoption, or marketplace
activity.

## 8. Workflow-directory information hierarchy

The directory answers “Which real workflow may fit my task?” in this order:

1. directory title and a short purpose statement;
2. working search and filters for task/category and platform;
3. result count derived from real data;
4. results showing workflow name, one-sentence purpose, platform, original
   creator when established, and license;
5. a clear route to each workflow detail page; and
6. a truthful empty state with the action `Clear filters`.

Do not give first-level visual priority to validation state, human-review
mechanics, permission matrices, package versions, schema language, or internal
Registry terms. Until evidence supports another sort, use a deterministic
non-popularity order such as alphabetical order. Do not add trending, ranking,
usage, or social-proof signals.

## 9. Workflow-detail information hierarchy

Each detail page follows this order:

1. **What is this?** Workflow name and one-sentence purpose.
2. **What does it do?** Intended result, platform, and concise use context.
3. **Who made it?** Original creator, exact upstream source, and Weft Place
   listing maintainer as three distinct roles.
4. **How do I get or use it?** A usable `Get workflow` path and any required
   import instructions.
5. **What important limitation should I know?** Show the most material known
   limitation, including the runtime-testing statement when applicable.
6. **Technical evidence only when requested.** Place deeper evidence in the
   collapsed sections defined in section 17.

Inputs, outputs, prerequisites, and a short usage outline may follow the primary
summary when they help a person use the workflow. Do not turn an internal
Registry record into the visible page structure.

## 10. Get-workflow behavior

`Get workflow` is the primary workflow-detail action. Its destination is chosen
from recorded evidence, in this order:

1. If an original public artifact can be directly retrieved and redistributed
   under the recorded evidence, provide that actual artifact.
2. If the platform requires import instructions, present those instructions
   before or alongside the artifact and offer `Copy import steps` when copying
   is functional.
3. If the correct acquisition path is an upstream repository or file, route to
   that exact source, not a generic repository homepage.
4. If none of these paths is usable, do not render an enabled-looking download
   or import action. Explain briefly that no usable acquisition path is
   currently available.

`View source` always means the most exact recorded upstream source available.
The action destination must not be inferred from a workflow name alone.

## 11. Author, upstream, and listing-maintainer semantics

The public content model has three independent concepts:

| Public label | Meaning |
| --- | --- |
| `Original creator` | Person or organization credited by available upstream evidence for the workflow artifact |
| `Upstream source` | Exact retrievable repository, file, and ref from which the artifact originates |
| `Listing maintained by` | Person or organization responsible for the Weft Place listing and its metadata |

Never use a Weft Place listing maintainer as the original creator unless the
same party actually authored the workflow. When authorship cannot be
established, say `Original creator not established from available evidence`.
Do not turn repository ownership into a stronger legal or sole-authorship claim
than the evidence supports.

These are public presentation concepts, not new Registry schema fields in this
phase. Implementation must map them from recorded manifest and provenance
evidence; it must not silently treat the current generic `author` value as all
three roles.

## 12. Open-first admission and Listing language

Weft Place is an open-first AI Workflow Registry. Human review is not a
universal prerequisite for a Workflow to become publicly Listed. Keep these
evidence and moderation states distinct:

- `Discovered`;
- `Listed`;
- `Static reviewed`;
- `Runtime tested`;
- `Compatibility verified`;
- `Human reviewed`;
- `Featured`; and
- `Quarantined` or `Removed`.

`Listed` means only that Weft Place included the Workflow with a traceable
source and sufficient minimum admission evidence. Listing does not imply that a
Workflow is safe, secure, runtime tested, compatible, production ready, high
quality, human reviewed, or recommended.

A Workflow is eligible for ordinary Listing when all of the following are true:

- it is a real upstream or legitimately submitted Workflow artifact;
- its repository source is identifiable and retrievable, or its direct-upload
  provenance is valid;
- provenance is recorded;
- license evidence has no clear blocking issue;
- the artifact can be parsed and is structurally plausible;
- no obvious secret or credential leakage is found;
- no clear malicious content is found; and
- no other high-confidence quarantine signal is present.

Independent runtime testing by Weft Place is not mandatory for ordinary
Listing. Use `Runtime-tested by Weft Place` only when corresponding runtime
evidence is recorded. Otherwise the evidence model may state:

> Not independently runtime-tested by Weft Place.

Schema validation, successful parsing, static inspection, and Listing status
are never proof of safety, compatibility, executability, production readiness,
or quality. Prefer the neutral state `Listed on Weft Place`. Use `validated`,
`verified`, `trusted`, `runtime tested`, `compatibility verified`, or `human
reviewed` only when the precise claim is independently supported and useful in
context.

Human review is required as an escalation mechanism for ambiguous provenance;
ambiguous or conflicting licenses; possible secrets or credentials; suspicious
code execution; filesystem writes; destructive actions or external publishing;
high-risk network behavior; substantial source transformation; reports or
complaints; higher trust claims; and Featured or curated listings. It must not
become the default scaling bottleneck for ordinary Listings.

Listing, Workflow Package creation, and Adapter creation are separate
decisions. A public Listing does not require a local `packages/` Workflow
Package. `packages/` should primarily contain Weft Place-maintained Packages,
legally redistributable packaged artifacts, Adapters, and curated or
compatibility-supported Packages. Do not create a Package merely to make a
Workflow visible in the Registry. Create an Adapter only when it is needed.

## 13. Collection rules

- Collections are selected and ordered by a human curator.
- A collection needs a clear editorial purpose and real, relevant workflows.
- Publish it only while it contains at least one qualifying workflow; otherwise
  hide both the collection and its navigation entry.
- Counts, order, and descriptions must come from the actual collection.
- Do not create empty, fake, or placeholder collections for layout purposes.
- Do not add fabricated popularity, ranking, trending, usage, or social proof.
- A collection describes a useful grouping or sequence; it does not imply that
  its workflows are automatically connected or executed by Weft Place.

## 14. Submission and source transition model

The currently implemented public entry point is:

> Submission currently happens through a GitHub pull request. The contribution
> guide explains the files and checks required for consideration.

Use the action label `Submit workflow` and route it to a usable, exact entry
point. Ordinary submitters should not need to understand internal Package,
Registry, schema, Validator, or builder terminology before starting.

The long-term source model must support both repository-backed upstream
artifacts and direct-upload artifacts. Future product flows should let people
submit a repository URL or directly upload a Workflow artifact, view submission
status, and use ordinary discovery and acquisition features without a GitHub
account. GitHub remains an engineering and provenance source, not a requirement
for ordinary users.

Never invent a repository, commit, or upstream source for a direct upload.
Future direct-upload provenance should record `source_type = direct_upload`,
the submitter, upload timestamp, original artifact hash, declared author, and
declared license. Every direct upload must enter an isolated Intake or
quarantine boundary and must never directly mutate `packages/`, `registry/`, or
`website/`.

The simplified form, direct-upload flow, submission-status interface, and
backend are not implemented in this phase and must not be presented as
available.

## 15. English-first localization boundary

- The first public product is English only. Do not add a language selector or
  incomplete translated surfaces.
- Chinese and French are possible future locales, not current commitments.
- Keep product-authored labels and messages separate from raw Registry values so
  they can later be translated without renaming Registry fields or changing
  Registry semantics.
- Treat stable content concepts—such as original creator, acquisition path, and
  runtime-evidence state—as data; translate their display labels later.
- Do not translate workflow names, creator names, source paths, IDs, hashes,
  license expressions, or platform identifiers unless an authoritative localized
  value is explicitly recorded.

## 16. Content-writing rules

Voice is **direct, specific, calm, factual, and concise**.

- Lead with what a workflow does in plain language.
- Use short sentences and concrete verbs.
- Describe evidence and limitations at their actual scope.
- Use sentence case except for proper names and the wordmark.
- CTA labels describe real actions: `Get workflow`, `View source`, `Submit
  workflow`, `Clear filters`, and `Copy import steps`.
- Avoid `seamless`, `revolutionary`, `intelligent`, `powerful`, `supercharge`,
  `unlock`, and `next-generation`.
- Avoid repeated use of `validated`, `verified`, `trusted`, and `human reviewed`.
- Never claim popularity, safety, compatibility, successful execution,
  production readiness, endorsement, or quality without corresponding evidence.

## 17. Progressive technical disclosure

Technical evidence remains available in three accessible sections, collapsed by
default:

- **Technical details:** platform and version requirements, inputs, outputs,
  dependencies, declared capabilities or permissions, human checkpoints, and
  package version.
- **Source details:** upstream repository, exact file and ref, license evidence,
  attribution basis, artifact location, and recorded transformations.
- **Audit details:** schema/static results, warnings, runtime evidence and date,
  review record, and hashes.

The collapsed labels and their open/closed state must be keyboard and screen
reader accessible. A material limitation needed for an informed acquisition
decision must also appear in the primary summary; collapsing evidence must not
hide the limitation itself.

## 18. Implementation and non-implementation boundaries

This phase changes documentation only. It freezes public brand and content
behavior; it does not implement them.

Do not in this phase:

- modify website frontend code;
- modify `packages/`, `registry/`, `validator/`, or `tools/intake/`;
- rename the GitHub repository or change GitHub Pages paths;
- change schema IDs, schema fields, package identifiers, or established runtime
  identifiers;
- perform a bulk Weftalis-to-Weft Place replacement;
- add Source Serif 4, download fonts, or implement design tokens;
- add multilingual UI, a submission form, accounts, a database, payments,
  hosted workflow execution, or external service connections;
- create collections, listings, evidence, runtime claims, or acquisition links
  that do not exist; or
- commit, push, deploy, or publish these documentation changes.

Frontend and Registry implementation require a separately reviewed phase. That
phase must preserve the evidence limits and content hierarchy defined here.
