import Link from "next/link";

const links = [
  { href: "/workflows", label: "Discover" },
  { href: "/collections", label: "Collections" },
  { href: "/submit", label: "Submit" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav-shell">
        <Link className="brand" href="/" aria-label="Weftalis home">
          <span className="brand-mark" aria-hidden="true">
            W
          </span>
          <span>Weftalis</span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <span className="nav-disabled" aria-disabled="true" title="GitHub connection is not available in this prototype">
            GitHub <span aria-hidden="true">↗</span>
          </span>
        </nav>
      </div>
    </header>
  );
}
