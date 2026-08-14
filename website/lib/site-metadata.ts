import type { Metadata } from "next";
import { getSiteUrl } from "./site-config";

export const SITE_NAME = "Weft Place";
export const DEFAULT_SITE_TITLE = "Weft Place — The place for open AI workflows";
export const PUBLIC_SITE_DESCRIPTION =
  "Browse open AI workflow listings, understand their purpose, and inspect the available details before reuse.";

export function createPageMetadata({
  title,
  description = PUBLIC_SITE_DESCRIPTION,
  pathname,
}: {
  title: string;
  description?: string;
  pathname: string;
}): Metadata {
  const url = getSiteUrl(pathname);
  const socialImageUrl = getSiteUrl("og.png");
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
      images: [
        {
          url: socialImageUrl,
          width: 1200,
          height: 630,
          alt: "Weft Place — The place for open AI workflows.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [
        {
          url: socialImageUrl,
          alt: "Weft Place — The place for open AI workflows.",
        },
      ],
    },
  };
}
