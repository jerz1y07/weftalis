import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Weftalis — Open Workflow Registry",
    template: "%s · Weftalis",
  },
  description: "The open registry for reusable and verifiable workflows.",
  applicationName: "Weftalis",
  openGraph: {
    title: "Weftalis — Open Workflow Registry",
    description: "The open registry for reusable and verifiable workflows.",
    siteName: "Weftalis",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="page-main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
