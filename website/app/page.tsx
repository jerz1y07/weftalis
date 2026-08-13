import Form from "next/form";
import Link from "next/link";
import { WorkflowCard } from "@/components/workflow-card";
import {
  formatPublicLabel,
  getCategories,
  getFeaturedWorkflows,
  getPlatforms,
  getRegistry,
} from "@/lib/registry";

export default function Home() {
  const registry = getRegistry();
  const featuredWorkflows = getFeaturedWorkflows();
  const platforms = getPlatforms();
  const categories = getCategories();

  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="hero-wordmark">WEFT <span>PLACE</span></p>
            <h1>The place for open AI workflows.</h1>
            <p className="hero-lede">
              Find real workflow artifacts, understand what they do, and follow their recorded source to use them.
            </p>
            <Form className="hero-search" action="/workflows">
              <label htmlFor="home-workflow-search">Search workflows</label>
              <div>
                <input
                  id="home-workflow-search"
                  name="q"
                  type="search"
                  placeholder="Search by task, platform, or creator"
                />
                <button type="submit">Search</button>
              </div>
            </Form>
            <div className="hero-actions">
              <Link className="text-link" href="/workflows">
                Browse workflows <span aria-hidden="true">→</span>
              </Link>
              <Link className="quiet-link" href="/submit">
                Submit workflow
              </Link>
            </div>
          </div>
          <aside className="hero-index" aria-label="Current marketplace coverage">
            <p className="eyebrow">Browse what exists now</p>
            <strong>{registry.workflow_count} workflows</strong>
            <dl>
              <div><dt>Platforms</dt><dd>{platforms.map(formatPublicLabel).join(" · ")}</dd></div>
              <div><dt>Use cases</dt><dd>{categories.map(formatPublicLabel).join(" · ")}</dd></div>
              <div><dt>Access</dt><dd>Follow the exact source recorded for each workflow</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Available now</p>
            <h2>Current workflows</h2>
          </div>
          <Link className="text-link" href="/workflows">View all workflows <span aria-hidden="true">→</span></Link>
        </div>
        <div className="workflow-list">
          {featuredWorkflows.map((workflow) => <WorkflowCard workflow={workflow} key={workflow.id} />)}
        </div>
      </section>

      <section className="use-case-section">
        <div className="shell use-case-row">
          <div>
            <p className="eyebrow">Current use cases</p>
            <h2>Browse by use case</h2>
            <p>Explore the categories represented by current workflows.</p>
          </div>
          <div className="use-case-list" aria-label="Workflow use cases">
            {categories.map((category) => (
              <Link href={{ pathname: "/workflows", query: { category } }} key={category}>
                {formatPublicLabel(category)} <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="marketplace-note shell" aria-labelledby="marketplace-note-title">
        <p className="eyebrow">Strict underneath, simple on the surface</p>
        <h2 id="marketplace-note-title">Choose by purpose. Check the evidence when you need it.</h2>
        <p>A listing helps you discover a workflow and reach its recorded source. It is not proof of safety, compatibility, successful execution, production readiness, or quality.</p>
      </section>
    </>
  );
}
