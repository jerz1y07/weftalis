import Link from "next/link";
import type { RegistryWorkflow } from "@/lib/registry";
import { StatusBadge } from "./status-badge";

export function WorkflowCard({ workflow }: { workflow: RegistryWorkflow }) {
  return (
    <article className="workflow-card">
      <div className="card-topline">
        <span className="platform-badge">{workflow.platform}</span>
        <StatusBadge status={workflow.validation.status} />
      </div>
      <div>
        <p className="eyebrow">{workflow.categories.join(" · ") || "Uncategorized"}</p>
        <h3>
          <Link href={`/workflows/${workflow.id}`}>{workflow.name}</Link>
        </h3>
        <p className="card-description">{workflow.description}</p>
      </div>
      <dl className="card-facts">
        <div><dt>License</dt><dd>{workflow.license}</dd></div>
        <div><dt>Risk</dt><dd>{workflow.safety.risk_level}</dd></div>
        <div><dt>Human review</dt><dd>{workflow.human_review.required ? "Required" : "Not required"}</dd></div>
      </dl>
      <div className="card-footer">
        <span className="mono">v{workflow.version}</span>
        <Link className="text-link" href={`/workflows/${workflow.id}`}>
          Inspect workflow <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
