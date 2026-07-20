import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  createPageMetadata,
  DEFAULT_SITE_TITLE,
  PRODUCTION_SITE_URL,
  SITE_NAME,
} from "@/lib/site-metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: PRODUCTION_SITE_URL,
  applicationName: SITE_NAME,
  ...createPageMetadata({
    title: DEFAULT_SITE_TITLE,
    pathname: "",
  }),
  title: {
    default: DEFAULT_SITE_TITLE,
    template: "%s · Weftalis",
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
