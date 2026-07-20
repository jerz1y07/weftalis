import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Submit a workflow",
  description:
    "Learn how to propose reusable and verifiable AI workflows to the Weftalis open registry through GitHub pull requests.",
  pathname: "submit/",
});

const steps = [
  ["01", "Copy Package template", "Start with packages/_template so the Package structure stays consistent."],
  ["02", "Add workflow.yaml and source", "Describe public metadata and add the platform export without secrets."],
  ["03", "Run Validator", "Check Package structure, referenced files, permissions, and safety declarations locally."],
  ["04", "Run Registry Builder", "Confirm the validated Package is included in registry/registry.json."],
  ["05", "Open Pull Request", "Propose the plain-file change for automated checks and human review."],
];

export default function SubmitPage() {
  return (
    <div className="shell page-section submit-page">
      <header className="page-header centered-header">
        <p className="eyebrow">GitHub-native by design</p>
        <h1>Submit transparently.<br />Review in the open.</h1>
        <p>Weftalis Workflow Packages are proposed as plain files through pull requests—not uploaded into a closed platform.</p>
      </header>
      <div className="early-banner"><span aria-hidden="true">!</span><div><strong>No upload form or live GitHub connection</strong><p>This static page explains the repository-native process only. It does not submit files, call an API, or create an account.</p></div></div>
      <section className="submission-flow" aria-labelledby="submission-title">
        <div className="section-heading"><div><p className="eyebrow">Package contribution flow</p><h2 id="submission-title">Five clear steps</h2></div></div>
        <div className="step-grid">
          {steps.map(([number, title, text]) => <article className="submission-step" key={number}><span className="mono">{number}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>
      <section className="github-native-note">
        <div><p className="eyebrow">Why this approach</p><h2>Files you can inspect. Changes you can review.</h2></div>
        <p>A GitHub-native process can preserve version history, make discussion visible, and keep workflow packages portable. It does not mean every accepted package is automatically safe.</p>
      </section>
    </div>
  );
}
