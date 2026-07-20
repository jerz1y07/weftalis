import type { NextConfig } from "next";

const basePath = process.env.WEFTALIS_BASE_PATH ?? "";

if (
  basePath !== "" &&
  (!basePath.startsWith("/") || basePath.endsWith("/") || basePath.includes("//"))
) {
  throw new Error(
    'WEFTALIS_BASE_PATH must be empty or start with one "/" and have no trailing "/".',
  );
}

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
};

export default nextConfig;
