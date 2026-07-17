import type { Metadata } from "next";
import { WorkflowFilters } from "@/components/workflow-filters";
import { workflows } from "@/lib/workflows";

export const metadata: Metadata = { title: "Discover workflows" };

export default function WorkflowsPage() {
  return (
    <div className="shell page-section">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">Registry index</p>
          <h1>Discover workflows</h1>
          <p>Compare local examples by platform, purpose, version, and validation status.</p>
        </div>
        <div className="prototype-note">
          <span aria-hidden="true">i</span>
          <p><strong>Prototype data</strong>These entries are local examples and are not available for execution.</p>
        </div>
      </header>
      <WorkflowFilters workflows={workflows} />
    </div>
  );
}
