import Link from "next/link";
import {
  formatPublicLabel,
  getMarketplaceWorkflow,
  type RegistryWorkflow,
} from "@/lib/registry";

export function WorkflowCard({ workflow }: { workflow: RegistryWorkflow }) {
  const marketplace = getMarketplaceWorkflow(workflow);

  return (
    <article className="workflow-card">
      <div className="workflow-main">
        <div className="card-topline">
          <span className="platform-badge">{formatPublicLabel(workflow.platform)}</span>
          <span className="category-line">
            {workflow.categories.map(formatPublicLabel).join(" · ") || "Uncategorized"}
          </span>
        </div>
        <h3>
          <Link href={`/workflows/${workflow.id}`}>{workflow.name}</Link>
        </h3>
        <p className="card-description">{marketplace.summary}</p>
        {marketplace.limitation ? (
          <p className="card-limitation">
            <span>What to know</span>
            {marketplace.limitation}
          </p>
        ) : null}
      </div>
      <div className="workflow-side">
        <div className="card-context">
          <p className="card-byline">
            {marketplace.originalCreator
              ? `By ${marketplace.originalCreator}`
              : `From the ${marketplace.sourceLabel}`}
          </p>
          <p className="card-license">{workflow.license} license</p>
        </div>
        <div className="card-actions">
          <Link className="card-view-action" href={`/workflows/${workflow.id}`}>
            View workflow <span aria-hidden="true">→</span>
          </Link>
          {marketplace.acquisitionUrl ? (
            <a className="quiet-link" href={marketplace.acquisitionUrl}>
              Get workflow <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="quiet-link">Acquisition unavailable</span>
          )}
        </div>
      </div>
    </article>
  );
}
