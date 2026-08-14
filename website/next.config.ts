import type { NextConfig } from "next";
import { SITE_BASE_PATH } from "./lib/site-config";

const nextConfig: NextConfig = {
  output: "export",
  basePath: SITE_BASE_PATH,
  trailingSlash: true,
};

export default nextConfig;
