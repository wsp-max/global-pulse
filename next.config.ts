import type { NextConfig } from "next";

const rawBasePath = process.env.NEXT_BASE_PATH?.trim() ?? "";
const basePath = rawBasePath
  ? rawBasePath.startsWith("/")
    ? rawBasePath
    : `/${rawBasePath}`
  : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@global-pulse/shared"],
  basePath: basePath || undefined,
};

export default nextConfig;


