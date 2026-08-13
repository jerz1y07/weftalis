import Link from "next/link";
import { WorkflowCard } from "@/components/workflow-card";
import {
  formatRegistryDate,
  getFeaturedWorkflows,
  getPlatforms,
  getRegistry,
} from "@/lib/registry";

const directoryPrinciples = [
  {
    icon: "01",
    title: "Browse real listings",
    text: "Start with workflows already recorded in the public directory.",
  },
  {
    icon: "02",
    title: "Understand the purpose",
    text: "Read what each workflow is intended to do and which platform it uses.",
  },
  {
    icon: "03",
    title: "Inspect before reuse",
    text: "Review the recorded details and limitations before deciding what to do next.",
  },
];

export default function Home() {
  const registry = getRegistry();
  const featuredWorkflows = getFeaturedWorkflows();
  const platforms = getPlatforms();

  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="announcement">
              <span className="announcement-dot" aria-hidden="true" />
              Weft Place · Open workflow directory · {registry.workflow_count} workflows
            </div>
            <h1>The place for open AI workflows.</h1>
            <p className="hero-lede">
              Browse real workflow listings, understand their purpose, and inspect the available details before reuse.
            </p>
            <div className="hero-actions">
              <Link className="button primary-button" href="/workflows">
                Browse workflows <span aria-hidden="true">→</span>
              </Link>
              <Link className="button secondary-button" href="/submit">
                Submit workflow
              </Link>
            </div>
          </div>
          <div className="hero-index" aria-label="Directory overview">
            <p className="eyebrow">Current directory</p>
            <strong>{registry.workflow_count} listed workflows</strong>
            <dl>
              <div><dt>Find</dt><dd>Browse by task and platform</dd></div>
              <div><dt>Read</dt><dd>Understand each stated purpose</dd></div>
              <div><dt>Inspect</dt><dd>Review recorded details and limitations</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">From the directory</p>
            <h2>Featured workflows</h2>
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
            <p className="eyebrow">Current coverage</p>
            <h2>Platforms in the directory</h2>
            <p>Current listings represent the workflow platforms recorded in the Registry.</p>
          </div>
          <div className="platform-list" aria-label="Supported platforms">
            {platforms.map((platform) => (
              <span key={platform}><b aria-hidden="true">{platform.slice(0, 1).toUpperCase()}</b> {platform}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell trust-section">
        <div className="section-heading trust-heading">
          <div>
            <p className="eyebrow">How to use Weft Place</p>
            <h2>A clear path through the directory</h2>
          </div>
          <p>A listing provides context, not proof of safety, compatibility, execution, production readiness, or quality.</p>
        </div>
        <div className="trust-grid">
          {directoryPrinciples.map((item) => (
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
