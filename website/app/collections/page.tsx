import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI Content Operations Stack" };

const collectionSteps = [
  ["01", "Source Discovery", "Gather relevant source material for a defined content question."],
  ["02", "Evidence Collection", "Organize supporting evidence and record where each finding came from."],
  ["03", "Research Brief", "Turn the collected evidence into a structured, reviewable brief."],
  ["04", "Draft Generation", "Create a first draft grounded in the approved research brief."],
  ["05", "Style Review", "Check structure, clarity, tone, and alignment with the intended audience."],
  ["06", "Fact Checking", "Verify important claims and flag any evidence gaps before approval."],
  ["07", "Human Approval", "Require a person to approve accuracy, safety, and readiness before release."],
  ["08", "Performance Analysis", "Review outcome signals and feed useful learning into the next cycle."],
];

export default function CollectionsPage() {
  return (
    <div className="shell page-section collection-page">
      <header className="page-header collection-header">
        <div>
          <p className="eyebrow">Curated workflow collection</p>
          <h1>AI Content<br />Operations Stack</h1>
          <p>An inspectable, human-reviewed content process—from finding source material to learning from published work.</p>
        </div>
        <div className="collection-stat"><strong className="mono">08</strong><span>Connected stages</span><small>Concept collection · local prototype</small></div>
      </header>
      <section className="collection-flow" aria-label="AI Content Operations Stack stages">
        {collectionSteps.map(([number, title, text], index) => (
          <article className="collection-item" key={number}>
            <div className="collection-marker"><span className="mono">{number}</span>{index < collectionSteps.length - 1 && <i aria-hidden="true" />}</div>
            <div><h2>{title}</h2><p>{text}</p><span className={title === "Human Approval" ? "stage-tag review-tag" : "stage-tag"}>{title === "Human Approval" ? "Required checkpoint" : "Workflow stage"}</span></div>
          </article>
        ))}
      </section>
      <div className="collection-disclaimer"><strong>This collection is a blueprint, not an execution engine.</strong><p>Each stage represents a future reusable package. Connections and platform actions are intentionally inactive in this prototype.</p></div>
    </div>
  );
}
