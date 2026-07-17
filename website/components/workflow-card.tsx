import Link from "next/link";
import type { Workflow } from "@/lib/workflows";
import { StatusBadge } from "./status-badge";

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  return (
    <article className="workflow-card">
      <div className="card-topline">
        <span className="platform-badge">{workflow.platform}</span>
        <StatusBadge verified={workflow.verified} />
      </div>
      <div>
        <p className="eyebrow">{workflow.category}</p>
        <h3>
          <Link href={`/workflows/${workflow.slug}`}>{workflow.name}</Link>
        </h3>
        <p className="card-description">{workflow.description}</p>
      </div>
      <div className="card-footer">
        <span className="mono">v{workflow.version}</span>
        <Link className="text-link" href={`/workflows/${workflow.slug}`}>
          Inspect workflow <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
