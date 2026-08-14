import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkflowFilters } from "@/components/workflow-filters";
import { getAllWorkflows, getRegistry } from "@/lib/registry";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Workflows",
  description:
    "Browse open AI workflow listings by platform, purpose, and category on Weft Place.",
  pathname: "workflows/",
});

export default function WorkflowsPage() {
  const registry = getRegistry();
  const workflows = getAllWorkflows();

  return (
    <div className="shell page-section">
      <header className="page-header directory-header">
        <div>
          <p className="eyebrow">Workflow marketplace</p>
          <h1>Find a workflow</h1>
          <p>Search {registry.workflow_count} current workflows by what they do, where they run, or where they come from.</p>
        </div>
      </header>
      <Suspense fallback={<div className="directory-loading">Loading workflow search…</div>}>
        <WorkflowFilters workflows={workflows} />
      </Suspense>
    </div>
  );
}
