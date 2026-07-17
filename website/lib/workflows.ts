export type Workflow = {
  slug: string;
  name: string;
  description: string;
  author: string;
  platform: "n8n" | "Dify";
  category: string;
  version: string;
  verified: boolean;
  license: string;
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  permissions: string[];
  reviewCheckpoints: string[];
  steps: string[];
};

export const workflows: Workflow[] = [
  {
    slug: "multi-source-research-assistant",
    name: "Multi-Source Research Assistant",
    description:
      "Turn a focused research question into a structured evidence pack with source notes, key findings, and review-ready conclusions.",
    author: "Open Workflow Registry",
    platform: "n8n",
    category: "Research",
    version: "1.2.0",
    verified: true,
    license: "MIT",
    inputs: ["Research question", "Keyword list", "Date range"],
    outputs: ["Source inventory", "Evidence summary", "Research brief"],
    dependencies: ["Local sample source index", "Text analysis model (placeholder)"],
    permissions: ["Read supplied source files", "Write results to a local output folder"],
    reviewCheckpoints: [
      "Confirm source relevance before synthesis",
      "Approve the final research brief before reuse",
    ],
    steps: [
      "Normalize the research question and keywords.",
      "Collect matching items from the supplied source set.",
      "Compare evidence across sources and flag uncertain claims.",
      "Ask a reviewer to approve the selected evidence.",
      "Assemble the approved findings into a research brief.",
    ],
  },
  {
    slug: "document-review-pipeline",
    name: "Document Review Pipeline",
    description:
      "Review a set of documents for completeness, consistency, open questions, and claims that require human verification.",
    author: "Registry Examples Team",
    platform: "Dify",
    category: "Knowledge Operations",
    version: "0.9.1",
    verified: true,
    license: "Apache-2.0",
    inputs: ["Review objective", "Document set", "Review criteria"],
    outputs: ["Review summary", "Issue register", "Open questions"],
    dependencies: ["Dify workflow runtime (not connected in this prototype)"],
    permissions: ["Read user-provided documents"],
    reviewCheckpoints: ["Verify every flagged claim", "Approve the review summary before sharing"],
    steps: [
      "Extract the review objective, criteria, and constraints.",
      "Compare documents for gaps and inconsistencies.",
      "Draft a structured review summary and issue register.",
      "Require a reviewer to validate findings and open questions.",
    ],
  },
  {
    slug: "human-approved-publishing-flow",
    name: "Human-Approved Publishing Flow",
    description:
      "Coordinate topic selection, drafting, voice adjustment, and mandatory editorial approval before content is released.",
    author: "Community Sandbox",
    platform: "n8n",
    category: "Content Operations",
    version: "0.4.0",
    verified: false,
    license: "MIT",
    inputs: ["Approved topic", "Research brief", "Voice guidelines"],
    outputs: ["Reviewed content draft", "Editor feedback log"],
    dependencies: ["Local prompt templates", "Human editor"],
    permissions: ["Read supplied research", "Write a local draft file"],
    reviewCheckpoints: [
      "Approve the outline before drafting",
      "Editorial sign-off is required before release",
    ],
    steps: [
      "Create an outline from the approved topic and evidence.",
      "Pause for an editor to approve the outline.",
      "Draft and rewrite using the supplied voice guidelines.",
      "Collect final editorial feedback and revision notes.",
    ],
  },
];

export const platforms = [...new Set(workflows.map((workflow) => workflow.platform))];
export const categories = [...new Set(workflows.map((workflow) => workflow.category))];

export function getWorkflow(slug: string) {
  return workflows.find((workflow) => workflow.slug === slug);
}
