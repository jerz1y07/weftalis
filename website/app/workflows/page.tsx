import type { Metadata } from "next";
import { WorkflowFilters } from "@/components/workflow-filters";
import {
  formatRegistryDate,
  getAllWorkflows,
  getRegistry,
} from "@/lib/registry";
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
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">Registry index</p>
          <h1>Workflows</h1>
          <p>Browse current Weft Place listings by platform, purpose, and category.</p>
        </div>
        <div className="prototype-note">
          <span aria-hidden="true">i</span>
          <p><strong>{registry.workflow_count} Registry entries</strong>Last generated {formatRegistryDate(registry.generated_at)}. The website does not execute workflows.</p>
        </div>
      </header>
      <WorkflowFilters workflows={workflows} />
    </div>
  );
}
