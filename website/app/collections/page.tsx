import type { Metadata } from "next";
import Link from "next/link";
import { formatPublicLabel, getWorkflowById } from "@/lib/registry";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Research and Writing Starter Stack",
  description:
    "Explore a human-directed research and writing collection built from workflows listed on Weft Place.",
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
      <header className="page-header collection-header">
        <div>
          <p className="eyebrow">A practical starting point</p>
          <h1>Research and Writing<br />Starter Stack</h1>
          <p>First prepare reviewed research material, then use it as supplied material in a human-directed writing process.</p>
        </div>
        <div className="collection-stat"><strong className="mono">02</strong><span>Workflows</span><small>Research, then writing</small></div>
      </header>
      <section className="collection-flow" aria-label="Research and Writing Starter Stack workflows">
        {collectionWorkflows.map((workflow, index) => (
          <article className="collection-item" key={workflow.id}>
            <div className="collection-marker"><span className="mono">{String(index + 1).padStart(2, "0")}</span>{index < collectionWorkflows.length - 1 && <i aria-hidden="true" />}</div>
            <div>
              <div className="collection-badges">
                <span className="platform-badge">{formatPublicLabel(workflow.platform)}</span>
              </div>
              <h2><Link href={`/workflows/${workflow.id}`}>{workflow.name}</Link></h2>
              <p>{workflow.description}</p>
              <span className="stage-tag">{index === 0 ? "Prepare research material" : "Human-reviewed writing"}</span>
            </div>
          </article>
        ))}
      </section>
      <div className="collection-disclaimer"><strong>A human-directed sequence</strong><p>The order explains one possible process. The two workflows are not automatically connected.</p></div>
    </div>
  );
}
