const LEGACY_DEFAULT_SITE_URL = "https://jerz1y07.github.io/weftalis/";

function readBasePath() {
  const variableName =
    process.env.SITE_BASE_PATH !== undefined
      ? "SITE_BASE_PATH"
      : process.env.WEFTALIS_BASE_PATH !== undefined
        ? "WEFTALIS_BASE_PATH"
        : "SITE_BASE_PATH";
  const basePath =
    process.env.SITE_BASE_PATH ?? process.env.WEFTALIS_BASE_PATH ?? "";

  if (
    basePath !== "" &&
    (!basePath.startsWith("/") ||
      basePath.endsWith("/") ||
      basePath.includes("//"))
  ) {
    throw new Error(
      `${variableName} must be empty or start with one "/" and have no trailing "/".`,
    );
  }

  return basePath;
}

function readSiteUrl() {
  const configuredUrl = process.env.SITE_URL ?? LEGACY_DEFAULT_SITE_URL;
  let siteUrl: URL;

  try {
    siteUrl = new URL(configuredUrl);
  } catch {
    throw new Error("SITE_URL must be an absolute URL.");
  }

  if (!["http:", "https:"].includes(siteUrl.protocol)) {
    throw new Error("SITE_URL must use http or https.");
  }
  if (siteUrl.username || siteUrl.password || siteUrl.search || siteUrl.hash) {
    throw new Error(
      "SITE_URL must not contain credentials, a query string, or a fragment.",
    );
  }
  if (siteUrl.pathname.includes("//")) {
    throw new Error("SITE_URL must not contain a repeated path separator.");
  }

  siteUrl.pathname = `${siteUrl.pathname.replace(/\/+$/, "")}/`;
  return siteUrl;
}

export const SITE_BASE_PATH = readBasePath();
export const SITE_URL = readSiteUrl();

const hasExplicitPublicConfiguration =
  process.env.SITE_URL !== undefined ||
  process.env.SITE_BASE_PATH !== undefined ||
  process.env.WEFTALIS_BASE_PATH !== undefined;
const expectedSitePathname = SITE_BASE_PATH === "" ? "/" : `${SITE_BASE_PATH}/`;

if (
  hasExplicitPublicConfiguration &&
  SITE_URL.pathname !== expectedSitePathname
) {
  throw new Error(
    `SITE_URL pathname (${SITE_URL.pathname}) must match SITE_BASE_PATH (${SITE_BASE_PATH || "<empty>"}).`,
  );
}

export function getSiteUrl(pathname = "") {
  return new URL(pathname.replace(/^\/+/, ""), SITE_URL);
}
