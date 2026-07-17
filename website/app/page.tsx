import Link from "next/link";
import { WorkflowCard } from "@/components/workflow-card";
import { workflows } from "@/lib/workflows";

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
  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="announcement">
              <span className="announcement-dot" aria-hidden="true" />
              Early prototype · local data only
            </div>
            <h1>Discover reusable and verifiable AI workflows</h1>
            <p className="hero-lede">
              Explore transparent workflow packages across tools. Understand what they need, how they work,
              and where human review matters—before you reuse anything.
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
              <p><span className="code-key">name:</span> multi-source-research</p>
              <p><span className="code-key">version:</span> 1.2.0</p>
              <p><span className="code-key">platform:</span> n8n</p>
              <p><span className="code-key">permissions:</span></p>
              <p className="indent">- read_supplied_sources</p>
              <p><span className="code-key">human_review:</span></p>
              <p className="indent">- validate_evidence</p>
              <p className="indent">- approve_final_brief</p>
            </div>
            <div className="preview-validation">
              <span className="validation-icon" aria-hidden="true">✓</span>
              <div>
                <strong>Package structure validated</strong>
                <span>Human review still required</span>
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
          {workflows.map((workflow) => <WorkflowCard workflow={workflow} key={workflow.slug} />)}
        </div>
      </section>

      <section className="platform-section">
        <div className="shell platform-row">
          <div>
            <p className="eyebrow">Portable by design</p>
            <h2>Supported Platforms</h2>
            <p>Examples currently represent two workflow ecosystems. More can be described as the open package format evolves.</p>
          </div>
          <div className="platform-list" aria-label="Supported platforms">
            <span><b aria-hidden="true">N</b> n8n</span>
            <span><b aria-hidden="true">D</b> Dify</span>
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
