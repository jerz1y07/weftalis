import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { getWorkflow, workflows } from "@/lib/workflows";

type WorkflowDetailProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return workflows.map((workflow) => ({ slug: workflow.slug }));
}

export async function generateMetadata({ params }: WorkflowDetailProps): Promise<Metadata> {
  const workflow = getWorkflow((await params).slug);
  return { title: workflow?.name ?? "Workflow not found" };
}

function DetailList({ items }: { items: string[] }) {
  return <ul className="detail-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

export default async function WorkflowDetailPage({ params }: WorkflowDetailProps) {
  const workflow = getWorkflow((await params).slug);
  if (!workflow) notFound();

  return (
    <div className="shell page-section detail-page">
      <Link className="back-link" href="/workflows"><span aria-hidden="true">←</span> All workflows</Link>
      <header className="detail-hero">
        <div className="detail-title">
          <div className="card-topline detail-badges">
            <span className="platform-badge">{workflow.platform}</span>
            <StatusBadge verified={workflow.verified} />
          </div>
          <h1>{workflow.name}</h1>
          <p>{workflow.description}</p>
        </div>
        <div className="detail-actions">
          <button className="button primary-button" disabled>Download package</button>
          <button className="button secondary-button" disabled>View source ↗</button>
          <small>Actions are disabled in this prototype.</small>
        </div>
      </header>

      <div className="metadata-strip">
        <div><span>Author</span><strong>{workflow.author}</strong></div>
        <div><span>Version</span><strong className="mono">v{workflow.version}</strong></div>
        <div><span>Category</span><strong>{workflow.category}</strong></div>
        <div><span>License</span><strong>{workflow.license}</strong></div>
      </div>

      <div className="detail-layout">
        <div className="detail-content">
          <section className="detail-section">
            <div className="detail-section-heading"><span className="section-icon">↔</span><div><p className="eyebrow">Data contract</p><h2>Inputs &amp; outputs</h2></div></div>
            <div className="two-column-list">
              <div><h3>Inputs</h3><DetailList items={workflow.inputs} /></div>
              <div><h3>Outputs</h3><DetailList items={workflow.outputs} /></div>
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-heading"><span className="section-icon">◇</span><div><p className="eyebrow">Requirements</p><h2>Dependencies &amp; permissions</h2></div></div>
            <div className="two-column-list">
              <div><h3>Dependent services</h3><DetailList items={workflow.dependencies} /></div>
              <div><h3>Declared permissions</h3><DetailList items={workflow.permissions} /></div>
            </div>
          </section>

          <section className="detail-section review-section">
            <div className="detail-section-heading"><span className="section-icon">✓</span><div><p className="eyebrow">Required judgment</p><h2>Human review checkpoints</h2></div></div>
            <DetailList items={workflow.reviewCheckpoints} />
          </section>

          <section className="detail-section">
            <div className="detail-section-heading"><span className="section-icon">#</span><div><p className="eyebrow">Example sequence</p><h2>Workflow steps</h2></div></div>
            <ol className="steps-list">
              {workflow.steps.map((step, index) => <li key={step}><span className="mono">{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}
            </ol>
          </section>
        </div>

        <aside className="validation-panel">
          <p className="eyebrow">Validation status</p>
          <StatusBadge verified={workflow.verified} />
          <h2>{workflow.verified ? "Structure reviewed" : "Awaiting review"}</h2>
          <p>{workflow.verified ? "Required metadata is present in this local example." : "This example has not completed the prototype review process."}</p>
          <div className="validation-divider" />
          <p className="validation-warning"><strong>Important</strong>Validation does not guarantee safety, quality, or fitness for your use case. Inspect every package yourself.</p>
        </aside>
      </div>
    </div>
  );
}
