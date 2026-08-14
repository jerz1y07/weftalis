import Link from "next/link";

const links = [
  { href: "/workflows", label: "Workflows" },
  { href: "/collections", label: "Collections" },
  { href: "/submit", label: "Submit workflow" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav-shell">
        <Link className="brand" href="/" aria-label="Weft Place home">
          <span className="wordmark-primary">WEFT</span>
          <span className="wordmark-secondary">PLACE</span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
