import type { Metadata } from "next";

export const metadata: Metadata = { title: "Submit a workflow" };

const steps = [
  ["01", "Fork repository", "Start from your own copy of the project repository."],
  ["02", "Copy package template", "Use the shared structure so metadata stays consistent and inspectable."],
  ["03", "Add workflow files", "Include the workflow definition, documentation, permissions, and review points."],
  ["04", "Open a pull request", "Propose the package for automated checks and careful human review."],
];

export default function SubmitPage() {
  return (
    <div className="shell page-section submit-page">
      <header className="page-header centered-header">
        <p className="eyebrow">GitHub-native by design</p>
        <h1>Submit transparently.<br />Review in the open.</h1>
        <p>In the future, workflow packages will be proposed as plain files through pull requests—not uploaded into a closed platform.</p>
      </header>
      <div className="early-banner"><span aria-hidden="true">!</span><div><strong>Submissions are not open yet</strong><p>This is an early visual prototype. The repository connection, package specification, and review automation will arrive in later phases.</p></div></div>
      <section className="submission-flow" aria-labelledby="submission-title">
        <div className="section-heading"><div><p className="eyebrow">Planned contribution flow</p><h2 id="submission-title">Four clear steps</h2></div></div>
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
