import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Submit a workflow",
  description:
    "Learn how to propose an AI workflow listing to Weft Place through a GitHub pull request.",
  pathname: "submit/",
});

const submissionGuideUrl =
  "https://github.com/jerz1y07/weftalis/blob/main/docs/submitting-workflows.md";
const projectSourceUrl = "https://github.com/jerz1y07/weftalis";

export default function SubmitPage() {
  return (
    <div className="shell page-section submit-page">
      <header className="page-header submit-header">
        <p className="eyebrow">Submit workflow</p>
        <h1>Share an existing open workflow with Weft Place.</h1>
        <p>The current submission path uses a GitHub pull request. Direct upload is not available yet.</p>
      </header>

      <section className="submission-method" aria-labelledby="submission-method-title">
        <div>
          <p className="eyebrow">Current submission method</p>
          <h2 id="submission-method-title">Repository and source contribution through GitHub</h2>
          <p>Follow the repository guide to prepare your workflow source and open a pull request. The guide covers the technical steps after you choose to contribute.</p>
        </div>
        <div className="submission-action">
          <a className="button primary-button" href={submissionGuideUrl}>Open submission on GitHub <span aria-hidden="true">↗</span></a>
          <small>This opens the real submission guide in the Weft Place project repository.</small>
        </div>
      </section>

      <div className="submission-info-grid">
        <section aria-labelledby="submission-needs-title">
          <p className="eyebrow">What you need</p>
          <h2 id="submission-needs-title">Before you start</h2>
          <ul className="submission-list">
            <li>A public source that others can retrieve</li>
            <li>The exact workflow artifact or path</li>
            <li>Author and source information supported by available evidence</li>
            <li>License evidence for the workflow</li>
            <li>A source file with no passwords, tokens, credentials, or private data</li>
          </ul>
        </section>
        <section aria-labelledby="submission-next-title">
          <p className="eyebrow">What happens next</p>
          <h2 id="submission-next-title">From intake to listing</h2>
          <ol className="submission-list numbered-list">
            <li>Automated checks inspect the contribution and its recorded source.</li>
            <li>Ordinary submissions with sufficient evidence may become Listed without universal human approval.</li>
            <li>Unusual or high-risk submissions may require review or be quarantined.</li>
          </ol>
        </section>
      </div>

      <section className="contributor-note">
        <div>
          <p className="eyebrow">Advanced contributors</p>
          <h2>Need the repository details?</h2>
        </div>
        <div>
          <p>The submission guide explains the current file layout and local checks. The project source includes contribution rules and the pull request template.</p>
          <div className="contributor-links">
            <a className="text-link" href={submissionGuideUrl}>Read the submission guide <span aria-hidden="true">↗</span></a>
            <a className="quiet-link" href={projectSourceUrl}>Project source <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>
    </div>
  );
}
