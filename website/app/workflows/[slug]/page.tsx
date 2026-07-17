import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import {
  formatRegistryDate,
  getAllWorkflows,
  getWorkflowById,
  type RegistryField,
} from "@/lib/registry";

type WorkflowDetailProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllWorkflows().map((workflow) => ({ slug: workflow.id }));
}

export async function generateMetadata({ params }: WorkflowDetailProps): Promise<Metadata> {
  const workflow = getWorkflowById((await params).slug);
  if (!workflow) notFound();

  return {
    title: workflow.name,
    description: workflow.description,
  };
}

function DetailList({ items }: { items: string[] }) {
  return <ul className="detail-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function FieldList({ fields, inputs = false }: { fields: RegistryField[]; inputs?: boolean }) {
  return (
    <ul className="field-list">
      {fields.map((field) => (
        <li key={field.name}>
          <div>
            <strong className="mono">{field.name}</strong>
            <span>{field.type}{inputs ? ` · ${field.required ? "required" : "optional"}` : ""}</span>
          </div>
          <p>{field.description}</p>
        </li>
      ))}
    </ul>
  );
}

function labelFromKey(value: string) {
  return value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

export default async function WorkflowDetailPage({ params }: WorkflowDetailProps) {
  const workflow = getWorkflowById((await params).slug);
  if (!workflow) notFound();

  const testingItems = workflow.testing
    ? [
        `Status: ${workflow.testing.status}`,
        `Last tested: ${workflow.testing.last_tested ?? "Not declared"}`,
        `Tested platform version: ${workflow.testing.tested_platform_version ?? "Not declared"}`,
      ]
    : ["No testing metadata declared."];

  return (
    <div className="shell page-section detail-page">
      <Link className="back-link" href="/workflows"><span aria-hidden="true">←</span> All workflows</Link>
      <header className="detail-hero">
        <div className="detail-title">
          <div className="card-topline detail-badges">
            <span className="platform-badge">{workflow.platform}</span>
            <StatusBadge status={workflow.validation.status} />
          </div>
          <h1>{workflow.name}</h1>
          <p>{workflow.description}</p>
        </div>
        <div className="detail-actions">
          <button className="button primary-button" disabled>Download package</button>
          <button className="button secondary-button" disabled>View source ↗</button>
          <small>Actions are disabled. No download or GitHub link is available.</small>
        </div>
      </header>

      <div className="metadata-strip">
        <div><span>Workflow ID</span><strong className="mono">{workflow.id}</strong></div>
        <div><span>Author</span><strong>{workflow.author}</strong></div>
        <div><span>Version</span><strong className="mono">v{workflow.version}</strong></div>
        <div><span>License</span><strong>{workflow.license}</strong></div>
      </div>

      <div className="detail-layout">
        <div className="detail-content">
          <section className="detail-section">
            <div className="detail-section-heading"><span className="section-icon">↔</span><div><p className="eyebrow">Data contract</p><h2>Inputs &amp; outputs</h2></div></div>
            <div className="two-column-list">
              <div><h3>Inputs</h3><FieldList fields={workflow.inputs} inputs /></div>
              <div><h3>Outputs</h3><FieldList fields={workflow.outputs} /></div>
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-heading"><span className="section-icon">◇</span><div><p className="eyebrow">Runtime</p><h2>Platform &amp; classification</h2></div></div>
            <div className="two-column-list">
              <div>
                <h3>Platform</h3>
                <DetailList items={[workflow.platform, `Minimum version: ${workflow.minimum_platform_version}`]} />
              </div>
              <div>
                <h3>Categories &amp; tags</h3>
                <DetailList items={[
                  `Categories: ${workflow.categories.join(", ") || "None declared"}`,
                  `Tags: ${workflow.tags.join(", ") || "None declared"}`,
                ]} />
              </div>
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-heading"><span className="section-icon">!</span><div><p className="eyebrow">Declared access</p><h2>Permissions &amp; safety</h2></div></div>
            <div className="two-column-list">
              <div>
                <h3>Permissions</h3>
                <DetailList items={Object.entries(workflow.permissions).map(
                  ([key, enabled]) => `${labelFromKey(key)}: ${enabled ? "Declared" : "Not requested"}`,
                )} />
              </div>
              <div>
                <h3>Safety</h3>
                <DetailList items={[
                  `Risk level: ${workflow.safety.risk_level}`,
                  `Stores user data: ${workflow.safety.stores_user_data ? "Yes" : "No"}`,
                  `Sends data externally: ${workflow.safety.sends_data_externally ? "Yes" : "No"}`,
                  `Contains credentials: ${workflow.safety.contains_credentials ? "Yes" : "No"}`,
                ]} />
              </div>
            </div>
          </section>

          <section className="detail-section review-section">
            <div className="detail-section-heading"><span className="section-icon">✓</span><div><p className="eyebrow">Required judgment</p><h2>Human review</h2></div></div>
            <p className="detail-summary">Human review required: <strong>{workflow.human_review.required ? "Yes" : "No"}</strong></p>
            <DetailList items={workflow.human_review.checkpoints.length ? workflow.human_review.checkpoints : ["No checkpoints declared."]} />
          </section>

          <section className="detail-section">
            <div className="detail-section-heading"><span className="section-icon">#</span><div><p className="eyebrow">Package record</p><h2>Testing &amp; source metadata</h2></div></div>
            <div className="two-column-list">
              <div><h3>Testing</h3><DetailList items={testingItems} /></div>
              <div><h3>Registry paths</h3><DetailList items={[
                `Package: ${workflow.package_path}`,
                `Source file: ${workflow.source_file}`,
              ]} /></div>
            </div>
          </section>
        </div>

        <aside className="validation-panel">
          <p className="eyebrow">Validation status</p>
          <StatusBadge status={workflow.validation.status} />
          <h2>Validator checks passed</h2>
          <p>Checked {formatRegistryDate(workflow.validation.checked_at)}.</p>
          <div className="validation-divider" />
          <p className="validation-warning"><strong>Human review still recommended</strong>Validator approval does not guarantee absolute safety, quality, accuracy, or fitness for your use case. Inspect the package yourself before reuse.</p>
        </aside>
      </div>
    </div>
  );
}
