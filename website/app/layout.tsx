import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  createPageMetadata,
  DEFAULT_SITE_TITLE,
  SITE_NAME,
} from "@/lib/site-metadata";
import { SITE_URL } from "@/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  applicationName: SITE_NAME,
  ...createPageMetadata({
    title: DEFAULT_SITE_TITLE,
    pathname: "",
  }),
  title: {
    default: DEFAULT_SITE_TITLE,
    template: "%s · Weft Place",
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
