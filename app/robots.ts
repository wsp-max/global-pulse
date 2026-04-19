import type { MetadataRoute } from "next";

function normalizeBasePath(input?: string): string {
  const raw = input?.trim() ?? "";
  if (!raw) return "";
  return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
}

function resolveOrigin(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return appUrl.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const origin = resolveOrigin();
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${origin}${basePath}/sitemap.xml`,
  };
}
