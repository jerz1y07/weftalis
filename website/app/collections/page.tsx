import type { Metadata } from "next";
import Link from "next/link";
import { formatPublicLabel, getWorkflowById } from "@/lib/registry";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Collections",
  description:
    "Browse focused collections built from real workflows currently listed on Weft Place.",
  pathname: "collections/",
});

const collectionWorkflowIds = [
  "multi-source-research-assistant",
  "human-reviewed-writing-pipeline",
] as const;

const collectionWorkflows = collectionWorkflowIds.map((id) => {
  const workflow = getWorkflowById(id);
  if (!workflow) {
    throw new Error(`Collection build error: required Workflow "${id}" is missing from the Registry.`);
  }
  return workflow;
});

export default function CollectionsPage() {
  return (
    <div className="shell page-section collection-page">
      <header className="page-header collections-header">
        <p className="eyebrow">Collections</p>
        <h1>Focused ways to browse.</h1>
        <p>Weft Place currently has one collection, built only from workflows listed today.</p>
      </header>
      <article className="collection-entry" aria-labelledby="research-writing-title">
        <div className="collection-entry-intro">
          <div>
            <p className="eyebrow">Research and writing</p>
            <h2 id="research-writing-title">From source review to a reviewed draft</h2>
            <p>Start with evidence gathered from public sources, then use the reviewed material in a writing workflow with a human approval step.</p>
          </div>
          <p className="collection-count"><strong className="mono">{String(collectionWorkflows.length).padStart(2, "0")}</strong><span>Current workflows</span></p>
        </div>
        <ol className="collection-workflow-list" aria-label="Research and writing collection workflows">
          {collectionWorkflows.map((workflow, index) => (
            <li key={workflow.id}>
              <span className="collection-order mono">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p className="collection-step">{index === 0 ? "Prepare research material" : "Draft with human review"}</p>
                <h3><Link href={`/workflows/${workflow.id}`}>{workflow.name}</Link></h3>
                <p>{workflow.description}</p>
              </div>
              <div className="collection-workflow-meta">
                <span className="platform-badge">{formatPublicLabel(workflow.platform)}</span>
                <Link className="text-link" href={`/workflows/${workflow.id}`}>View workflow <span aria-hidden="true">→</span></Link>
              </div>
            </li>
          ))}
        </ol>
        <footer className="collection-note"><strong>A suggested sequence</strong><p>The order describes one possible process. These workflows are separate and are not automatically connected or run by Weft Place.</p></footer>
      </article>
    </div>
  );
}
