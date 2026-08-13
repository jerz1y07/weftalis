import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-brand">
          <Link className="brand" href="/" aria-label="Weft Place home">
            <span className="wordmark-primary">WEFT</span>
            <span className="wordmark-secondary">PLACE</span>
          </Link>
          <p>The place for open AI workflows.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/workflows">Workflows</Link>
          <Link href="/collections">Collections</Link>
          <Link href="/submit">Submit workflow</Link>
          <a href="https://github.com/jerz1y07/weftalis">Project source <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </footer>
  );
}
