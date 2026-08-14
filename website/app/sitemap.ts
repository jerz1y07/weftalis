import type { MetadataRoute } from "next";
import { getAllWorkflows } from "@/lib/registry";
import { getSiteUrl } from "@/lib/site-config";

const staticRoutes = ["", "workflows/", "collections/", "submit/"];

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const workflowRoutes = getAllWorkflows().map(
    (workflow) => `workflows/${workflow.id}/`,
  );

  return [...staticRoutes, ...workflowRoutes].map((pathname) => ({
    url: getSiteUrl(pathname).toString(),
  }));
}
