import Link from "next/link";
import { WorkflowCard } from "@/components/workflow-card";
import {
  formatRegistryDate,
  getFeaturedWorkflows,
  getPlatforms,
  getRegistry,
} from "@/lib/registry";

const trustPrinciples = [
  {
    icon: "01",
    title: "Inspect before reuse",
    text: "Inputs, outputs, dependencies, and permissions stay visible so adopters can make informed choices.",
  },
  {
    icon: "02",
    title: "Validation is explicit",
    text: "A clear status distinguishes structurally reviewed examples from workflows still awaiting review.",
  },
  {
    icon: "03",
    title: "Humans stay in control",
    text: "Review checkpoints show where judgment is required. The registry never runs a workflow for you.",
  },
];

export default function Home() {
  const registry = getRegistry();
  const featuredWorkflows = getFeaturedWorkflows();
  const platforms = getPlatforms();
  const exampleWorkflow = featuredWorkflows[0];

  if (!exampleWorkflow) {
    throw new Error("The homepage requires at least one Registry Workflow for its package preview.");
  }

  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="announcement">
              <span className="announcement-dot" aria-hidden="true" />
              Weftalis · Static Registry · {registry.workflow_count} workflows
            </div>
            <h1>Discover reusable and verifiable workflows</h1>
            <p className="hero-lede">
              Weftalis is an open-source registry for publishing, inspecting, validating, versioning, and
              reusing workflows across platforms. Understand each package before you reuse anything.
            </p>
            <div className="search-visual" role="search" aria-label="Workflow search preview">
              <span aria-hidden="true">⌕</span>
              <input aria-label="Search workflows" placeholder="Search workflows, platforms, or categories…" disabled />
              <span className="shortcut">Coming soon</span>
            </div>
            <div className="hero-actions">
              <Link className="button primary-button" href="/workflows">
                Browse workflows <span aria-hidden="true">→</span>
              </Link>
              <Link className="button secondary-button" href="/submit">
                How submission works
              </Link>
            </div>
          </div>
          <div className="registry-preview" aria-label="Example workflow package preview">
            <div className="preview-bar">
              <span>workflow.yaml</span>
              <span className="preview-dots" aria-hidden="true">•••</span>
            </div>
            <div className="code-lines mono" aria-hidden="true">
              <p><span className="code-key">id:</span> {exampleWorkflow.id}</p>
              <p><span className="code-key">version:</span> {exampleWorkflow.version}</p>
              <p><span className="code-key">platform:</span> {exampleWorkflow.platform}</p>
              <p><span className="code-key">permissions:</span></p>
              <p className="indent">network_access: {String(exampleWorkflow.permissions.network_access)}</p>
              <p><span className="code-key">human_review:</span></p>
              <p className="indent">required: {String(exampleWorkflow.human_review.required)}</p>
            </div>
            <div className="preview-validation">
              <span className="validation-icon" aria-hidden="true">✓</span>
              <div>
                <strong>Validation passed</strong>
                <span>Human review still recommended</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Curated examples</p>
            <h2>Featured Workflows</h2>
          </div>
          <Link className="text-link" href="/workflows">View all workflows <span aria-hidden="true">→</span></Link>
        </div>
        <div className="workflow-grid">
          {featuredWorkflows.map((workflow) => <WorkflowCard workflow={workflow} key={workflow.id} />)}
        </div>
        <p className="registry-timestamp">Registry last generated: {formatRegistryDate(registry.generated_at)}</p>
      </section>

      <section className="platform-section">
        <div className="shell platform-row">
          <div>
            <p className="eyebrow">Portable by design</p>
            <h2>Supported Platforms</h2>
            <p>Examples currently represent two workflow ecosystems. More can be described as the open package format evolves.</p>
          </div>
          <div className="platform-list" aria-label="Supported platforms">
            {platforms.map((platform) => (
              <span key={platform}><b aria-hidden="true">{platform.slice(0, 1).toUpperCase()}</b> {platform}</span>
            ))}
            <span className="muted-platform"><b aria-hidden="true">+</b> More later</span>
          </div>
        </div>
      </section>

      <section className="section shell trust-section">
        <div className="section-heading trust-heading">
          <div>
            <p className="eyebrow">Trust is a process</p>
            <h2>Clarity before execution</h2>
          </div>
          <p>A registry listing is context, not an endorsement. Safe reuse begins with transparent metadata and careful human judgment.</p>
        </div>
        <div className="trust-grid">
          {trustPrinciples.map((item) => (
            <article className="trust-card" key={item.icon}>
              <span className="principle-number mono">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
