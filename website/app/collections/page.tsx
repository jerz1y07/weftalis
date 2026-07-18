import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { getWorkflowById } from "@/lib/registry";

export const metadata: Metadata = { title: "Research and Writing Starter Stack" };

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
          <p className="eyebrow">Prototype collection · Registry data</p>
          <h1>Research and Writing<br />Starter Stack</h1>
          <p>A Weftalis prototype collection: first prepare reviewed research material, then use it as supplied material in a human-reviewed writing process.</p>
        </div>
        <div className="collection-stat"><strong className="mono">02</strong><span>Registry workflows</span><small>Ordered prototype collection</small></div>
      </header>
      <section className="collection-flow" aria-label="Research and Writing Starter Stack workflows">
        {collectionWorkflows.map((workflow, index) => (
          <article className="collection-item" key={workflow.id}>
            <div className="collection-marker"><span className="mono">{String(index + 1).padStart(2, "0")}</span>{index < collectionWorkflows.length - 1 && <i aria-hidden="true" />}</div>
            <div>
              <div className="collection-badges">
                <span className="platform-badge">{workflow.platform}</span>
                <StatusBadge status={workflow.validation.status} />
              </div>
              <h2><Link href={`/workflows/${workflow.id}`}>{workflow.name}</Link></h2>
              <p>{workflow.description}</p>
              <span className="stage-tag">{index === 0 ? "Prepare research material" : "Human-reviewed writing"}</span>
            </div>
          </article>
        ))}
      </section>
      <div className="collection-disclaimer"><strong>This is a prototype collection, not an execution engine.</strong><p>The order explains a possible human-directed process. These two Workflow Packages are not automatically connected, and the website does not run them online.</p></div>
    </div>
  );
}
