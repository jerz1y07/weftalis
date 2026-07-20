import type { MetadataRoute } from "next";
import { getAllWorkflows } from "@/lib/registry";
import { getProductionUrl } from "@/lib/site-metadata";

const staticRoutes = ["", "workflows/", "collections/", "submit/"];

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const workflowRoutes = getAllWorkflows().map(
    (workflow) => `workflows/${workflow.id}/`,
  );

  return [...staticRoutes, ...workflowRoutes].map((pathname) => ({
    url: getProductionUrl(pathname).toString(),
  }));
}
