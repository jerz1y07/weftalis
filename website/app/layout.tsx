import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Open Workflow Registry",
    template: "%s · Open Workflow Registry",
  },
  description: "Discover transparent, reusable, and reviewable AI workflows.",
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
