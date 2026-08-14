import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const websiteDirectory = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = path.join(websiteDirectory, "out");
const registryPath = path.join(websiteDirectory, "generated/registry.json");

function requireEnvironment(name) {
  if (process.env[name] === undefined) {
    throw new Error(`${name} must be set when checking a static export.`);
  }

  return process.env[name];
}

function readBasePath() {
  const value =
    process.env.SITE_BASE_PATH ?? process.env.WEFTALIS_BASE_PATH ?? "";

  if (
    value !== "" &&
    (!value.startsWith("/") || value.endsWith("/") || value.includes("//"))
  ) {
    throw new Error(
      'SITE_BASE_PATH must be empty or start with one "/" and have no trailing "/".',
    );
  }

  return value;
}

function readSiteUrl() {
  const value = requireEnvironment("SITE_URL");
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("SITE_URL must be an absolute URL.");
  }

  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}

function getSiteUrl(siteUrl, pathname = "") {
  return new URL(pathname.replace(/^\/+/, ""), siteUrl);
}

async function requireFile(filePath) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Expected generated file is missing: ${filePath}`);
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

function parseAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)].map(
      ([, name, value]) => [name.toLowerCase(), value.replaceAll("&amp;", "&")],
    ),
  );
}

function findMetadataValue(html, selector, value) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    if (attributes[selector] === value) {
      return attributes.content;
    }
  }

  return undefined;
}

function findCanonicalUrl(html) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    if ((attributes.rel ?? "").split(/\s+/).includes("canonical")) {
      return attributes.href;
    }
  }

  return undefined;
}

function extractReferences(html) {
  const references = [];

  for (const tag of html.match(/<[a-z][^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    for (const name of ["href", "src", "action"]) {
      if (attributes[name]) references.push(attributes[name]);
    }
    if (attributes.srcset) {
      for (const candidate of attributes.srcset.split(",")) {
        const [reference] = candidate.trim().split(/\s+/);
        if (reference) references.push(reference);
      }
    }
  }

  return references;
}

function getInternalPath(reference, pageUrl, siteUrl) {
  if (/^(?:#|mailto:|tel:|data:|javascript:)/i.test(reference)) return null;

  let resolved;
  try {
    resolved = new URL(reference, pageUrl);
  } catch {
    throw new Error(`Could not parse generated URL reference: ${reference}`);
  }

  return resolved.origin === siteUrl.origin ? resolved.pathname : null;
}

async function requireInternalTarget(internalPath, basePath) {
  if (
    basePath !== "" &&
    internalPath !== basePath &&
    !internalPath.startsWith(`${basePath}/`)
  ) {
    throw new Error(
      `Internal URL is missing the configured base path (${basePath}): ${internalPath}`,
    );
  }

  if (
    basePath !== "" &&
    (internalPath === `${basePath}${basePath}` ||
      internalPath.startsWith(`${basePath}${basePath}/`))
  ) {
    throw new Error(`Internal URL contains a duplicated base path: ${internalPath}`);
  }

  if (basePath === "" && /^\/weftalis(?:\/|$)/.test(internalPath)) {
    throw new Error(
      `Root-domain export contains an active legacy public path: ${internalPath}`,
    );
  }

  const applicationPath =
    basePath === "" ? internalPath : internalPath.slice(basePath.length) || "/";
  const relativePath = decodeURIComponent(applicationPath).replace(/^\/+/, "");
  const candidates = applicationPath.endsWith("/")
    ? [path.join(outputDirectory, relativePath, "index.html")]
    : [
        path.join(outputDirectory, relativePath),
        path.join(outputDirectory, relativePath, "index.html"),
        path.join(outputDirectory, `${relativePath}.html`),
      ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return;
    } catch {
      // Try the next static-export filename form.
    }
  }

  throw new Error(`Broken internal URL in generated HTML: ${internalPath}`);
}

async function check() {
  const siteUrl = readSiteUrl();
  const basePath = readBasePath();
  const expectedPathname = basePath === "" ? "/" : `${basePath}/`;

  if (siteUrl.pathname !== expectedPathname) {
    throw new Error(
      `SITE_URL pathname (${siteUrl.pathname}) does not match SITE_BASE_PATH (${basePath || "<empty>"}).`,
    );
  }

  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const routePathnames = [
    "",
    "workflows/",
    "collections/",
    "submit/",
    ...registry.workflows.map((workflow) => `workflows/${workflow.id}/`),
  ];
  const expectedSitemapUrls = routePathnames.map((pathname) =>
    getSiteUrl(siteUrl, pathname).toString(),
  );
  const socialImageUrl = getSiteUrl(siteUrl, "og.png").toString();

  for (const pathname of routePathnames) {
    const htmlPath = path.join(outputDirectory, pathname, "index.html");
    await requireFile(htmlPath);
    const html = await readFile(htmlPath, "utf8");
    const expectedPageUrl = getSiteUrl(siteUrl, pathname).toString();

    if (findCanonicalUrl(html) !== expectedPageUrl) {
      throw new Error(`Canonical URL mismatch in ${htmlPath}.`);
    }
    if (findMetadataValue(html, "property", "og:url") !== expectedPageUrl) {
      throw new Error(`Open Graph URL mismatch in ${htmlPath}.`);
    }
    if (findMetadataValue(html, "property", "og:image") !== socialImageUrl) {
      throw new Error(`Open Graph image mismatch in ${htmlPath}.`);
    }
    if (findMetadataValue(html, "name", "twitter:image") !== socialImageUrl) {
      throw new Error(`Twitter image mismatch in ${htmlPath}.`);
    }
  }

  await requireFile(path.join(outputDirectory, "404.html"));
  await requireFile(path.join(outputDirectory, "og.png"));
  await requireFile(
    path.join(outputDirectory, "googled457feb465d862b0.html"),
  );

  const sitemapText = await readFile(
    path.join(outputDirectory, "sitemap.xml"),
    "utf8",
  );
  const sitemapUrls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, value]) => value,
  );
  if (JSON.stringify(sitemapUrls) !== JSON.stringify(expectedSitemapUrls)) {
    throw new Error("Generated sitemap URLs do not match the expected routes.");
  }

  const robotsText = await readFile(
    path.join(outputDirectory, "robots.txt"),
    "utf8",
  );
  const expectedSitemapLine = `Sitemap: ${getSiteUrl(siteUrl, "sitemap.xml")}`;
  if (!robotsText.split(/\r?\n/).includes(expectedSitemapLine)) {
    throw new Error("Generated robots.txt does not point to the expected sitemap.");
  }

  const outputFiles = await listFiles(outputDirectory);
  const conflictCopies = outputFiles.filter((filePath) =>
    / \d+\.[^./]+$/.test(path.basename(filePath)),
  );
  if (conflictCopies.length > 0) {
    throw new Error(
      `Unexpected conflict-copy files found in static export: ${conflictCopies.join(", ")}`,
    );
  }

  const htmlFiles = outputFiles.filter((filePath) => filePath.endsWith(".html"));
  const staticAssetPaths = new Set();

  for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, "utf8");
    const relativeHtmlPath = path.relative(outputDirectory, htmlPath);
    const routePathname =
      relativeHtmlPath === "index.html"
        ? ""
        : relativeHtmlPath === "404.html"
          ? "404.html"
          : `${path.dirname(relativeHtmlPath)}/`;
    const pageUrl = getSiteUrl(siteUrl, routePathname);

    if (
      basePath === "" &&
      /(?:["'(=]|\\")\/weftalis(?:\/|["'?&#])/.test(html)
    ) {
      throw new Error(
        `Root-domain HTML contains an active legacy public path: ${htmlPath}`,
      );
    }

    for (const reference of extractReferences(html)) {
      const internalPath = getInternalPath(reference, pageUrl, siteUrl);
      if (internalPath === null) continue;
      if (internalPath.includes("/_next/")) staticAssetPaths.add(internalPath);
      await requireInternalTarget(internalPath, basePath);
    }
  }

  if (staticAssetPaths.size === 0) {
    throw new Error("No generated Next.js static asset references were found.");
  }

  console.log(
    `Static export check passed for ${routePathnames.length} routes, ${htmlFiles.length} HTML files, and ${staticAssetPaths.size} referenced Next.js assets at ${siteUrl}`,
  );
}

try {
  await check();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Static export check failed: ${message}`);
  process.exitCode = 1;
}
