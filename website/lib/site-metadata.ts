import type { Metadata } from "next";

export const SITE_NAME = "Weftalis";
export const PRODUCTION_SITE_URL = new URL(
  "https://jerz1y07.github.io/weftalis/",
);
export const DEFAULT_SITE_TITLE = "Weftalis — Open Workflow Registry";
export const PUBLIC_SITE_DESCRIPTION =
  "Weftalis is an open registry for reusable and verifiable AI workflows.";

export function getProductionUrl(pathname = "") {
  return new URL(pathname.replace(/^\/+/, ""), PRODUCTION_SITE_URL);
}

export function createPageMetadata({
  title,
  description = PUBLIC_SITE_DESCRIPTION,
  pathname,
}: {
  title: string;
  description?: string;
  pathname: string;
}): Metadata {
  const url = getProductionUrl(pathname);
  const socialTitle =
    title === DEFAULT_SITE_TITLE ? title : `${title} · ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: {
      canonical: url.toString(),
    },
    openGraph: {
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      url,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary",
      title: socialTitle,
      description,
    },
  };
}
