import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell page-section not-found-state">
      <p className="eyebrow">Page not found</p>
      <h1>This page isn’t here.</h1>
      <p>The address may have changed, or the page may no longer exist.</p>
      <div className="not-found-actions">
        <Link className="button primary-button" href="/workflows">Browse all workflows</Link>
        <Link className="quiet-link" href="/">Return home</Link>
      </div>
    </div>
  );
}
