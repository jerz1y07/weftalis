import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatPublicLabel,
  formatRegistryDate,
  getAllWorkflows,
  getMarketplaceWorkflow,
  getWorkflowById,
  type RegistryField,
} from "@/lib/registry";
import { createPageMetadata } from "@/lib/site-metadata";

type WorkflowDetailProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllWorkflows().map((workflow) => ({ slug: workflow.id }));
}

export async function generateMetadata({ params }: WorkflowDetailProps): Promise<Metadata> {
  const workflow = getWorkflowById((await params).slug);
  if (!workflow) notFound();

  return createPageMetadata({
    title: workflow.name,
    description: getMarketplaceWorkflow(workflow).summary,
    pathname: `workflows/${workflow.id}/`,
  });
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
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function WorkflowDetailPage({ params }: WorkflowDetailProps) {
  const workflow = getWorkflowById((await params).slug);
  if (!workflow) notFound();

  const marketplace = getMarketplaceWorkflow(workflow);
  const declaredCapabilities = Object.entries(workflow.permissions)
    .filter(([, enabled]) => enabled)
    .map(([key]) => labelFromKey(key));
  const testingItems = workflow.testing
    ? [
        workflow.testing.status === "untested"
          ? "Not independently runtime-tested by Weft Place."
          : `Recorded test status: ${workflow.testing.status}`,
        `Last tested: ${workflow.testing.last_tested ?? "Not recorded"}`,
        `Tested platform version: ${workflow.testing.tested_platform_version ?? "Not recorded"}`,
      ]
    : ["No testing metadata is recorded."];

  return (
    <div className="shell page-section detail-page">
      <Link className="back-link" href="/workflows"><span aria-hidden="true">←</span> All workflows</Link>

      <header className="detail-hero">
        <div className="detail-title">
          <p className="eyebrow">{formatPublicLabel(workflow.platform)} workflow</p>
          <h1>{workflow.name}</h1>
          <p className="detail-summary-lede">{marketplace.summary}</p>
          <p className="detail-source-line">
            {marketplace.originalCreator ? (
              <>Created by <strong>{marketplace.originalCreator}</strong> · from <a href={marketplace.sourceUrl}>{marketplace.sourceLabel}</a></>
            ) : (
              <>From the <a href={marketplace.sourceUrl}>{marketplace.sourceLabel}</a> · original creator not established from available evidence</>
            )}
          </p>
          <p className="detail-meta">
            {formatPublicLabel(workflow.platform)} <span>·</span> {workflow.license} <span>·</span> {workflow.categories.map(formatPublicLabel).join(" · ")}
          </p>
        </div>
        <div className="detail-actions">
          <a className="button primary-button" href={marketplace.acquisitionUrl}>
            Get workflow <span aria-hidden="true">↗</span>
          </a>
          <a className="button secondary-button" href={marketplace.sourceUrl}>
            View source <span aria-hidden="true">↗</span>
          </a>
          <small>Both actions open the exact recorded artifact or source.</small>
        </div>
      </header>

      <div className="primary-detail-sections">
        <section className="primary-detail-section">
          <p className="eyebrow">Purpose</p>
          <h2>What it does</h2>
          <p>{marketplace.summary}</p>
          <div className="outcome-list">
            <h3>Produces</h3>
            <ul>
              {workflow.outputs.map((output) => (
                <li key={output.name}>{output.description}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="primary-detail-section">
          <p className="eyebrow">Acquisition</p>
          <h2>How to use</h2>
          <ol className="use-steps">
            {marketplace.useSteps.map((step, index) => (
              <li key={step}><span className="mono">{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>
            ))}
          </ol>
        </section>

        <section className="primary-detail-section limitation-section">
          <p className="eyebrow">Important limitation</p>
          <h2>What to know</h2>
          <p>{marketplace.limitation ?? "No material limitation is recorded in the current listing."}</p>
          <p className="supporting-note">A Weft Place listing is not proof of safety, compatibility, successful execution, production readiness, or quality.</p>
        </section>
      </div>

      <div className="detail-disclosures">
        <details>
          <summary>
            <span><strong>Technical details</strong><small>Requirements, inputs, outputs, and declared capabilities</small></span>
            <span aria-hidden="true">+</span>
          </summary>
          <div className="disclosure-content">
            <div className="evidence-grid">
              <section>
                <h3>Platform and classification</h3>
                <dl className="evidence-list">
                  <div><dt>Platform</dt><dd>{formatPublicLabel(workflow.platform)}</dd></div>
                  <div><dt>Minimum version</dt><dd>{workflow.minimum_platform_version}</dd></div>
                  <div><dt>Package version</dt><dd>{workflow.version}</dd></div>
                  <div><dt>Use cases</dt><dd>{workflow.categories.map(formatPublicLabel).join(", ")}</dd></div>
                  <div><dt>Tags</dt><dd>{workflow.tags.map(formatPublicLabel).join(", ")}</dd></div>
                </dl>
              </section>
              <section>
                <h3>Declared capabilities</h3>
                <p>{declaredCapabilities.length ? declaredCapabilities.join(", ") : "None declared."}</p>
                <h3>Human checkpoints</h3>
                <p>{workflow.human_review.checkpoints.join(" ") || "No checkpoint is declared in the Workflow."}</p>
              </section>
            </div>
            <div className="two-column-list field-columns">
              <section><h3>Inputs</h3><FieldList fields={workflow.inputs} inputs /></section>
              <section><h3>Outputs</h3><FieldList fields={workflow.outputs} /></section>
            </div>
          </div>
        </details>

        <details>
          <summary>
            <span><strong>Source details</strong><small>Creator context, exact source, license, and transformations</small></span>
            <span aria-hidden="true">+</span>
          </summary>
          <div className="disclosure-content">
            <dl className="evidence-list wide-evidence-list">
              <div><dt>Original creator</dt><dd>{marketplace.originalCreator ?? "Not established from available evidence"}</dd></div>
              <div><dt>Upstream source</dt><dd><a href={marketplace.sourceUrl}>{marketplace.source.repository}</a></dd></div>
              <div><dt>Exact path</dt><dd className="mono">{marketplace.source.path}</dd></div>
              <div><dt>Recorded ref</dt><dd className="mono">{marketplace.source.ref}</dd></div>
              <div><dt>Attribution basis</dt><dd>{marketplace.source.attributionBasis}</dd></div>
              <div><dt>License evidence</dt><dd>{marketplace.source.licenseEvidence}</dd></div>
              <div><dt>Recorded transformation</dt><dd>{marketplace.source.transformation}</dd></div>
              <div><dt>Listing maintained by</dt><dd>{marketplace.listingMaintainer}</dd></div>
            </dl>
          </div>
        </details>

        <details>
          <summary>
            <span><strong>Audit details</strong><small>Testing, static Registry checks, review evidence, and hashes</small></span>
            <span aria-hidden="true">+</span>
          </summary>
          <div className="disclosure-content">
            <div className="evidence-grid">
              <section>
                <h3>Testing record</h3>
                <ul className="plain-list">{testingItems.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section>
                <h3>Registry check</h3>
                <ul className="plain-list">
                  <li>Recorded validation state: {workflow.validation.status}</li>
                  <li>Checked: {formatRegistryDate(workflow.validation.checked_at)}</li>
                  <li>Warnings recorded: {workflow.validation.warnings.length}</li>
                </ul>
              </section>
              <section>
                <h3>Declared safety metadata</h3>
                <ul className="plain-list">
                  <li>Risk level: {workflow.safety.risk_level}</li>
                  <li>Sends data externally: {workflow.safety.sends_data_externally ? "Yes" : "No"}</li>
                  <li>Stores user data: {workflow.safety.stores_user_data ? "Yes" : "No"}</li>
                  <li>Contains credentials: {workflow.safety.contains_credentials ? "Yes" : "No"}</li>
                </ul>
              </section>
              <section>
                <h3>Artifact hash</h3>
                <p className={marketplace.source.sha256 ? "mono hash-value" : undefined}>
                  {marketplace.source.sha256 ?? "No artifact hash is present in the public listing evidence."}
                </p>
              </section>
            </div>
            <p className="audit-note">These records describe declared metadata and static evidence at their stated scope. They do not establish safety or current platform compatibility.</p>
          </div>
        </details>
      </div>
    </div>
  );
}
