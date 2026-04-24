import type { MetadataRoute } from "next";
import { getPostgresPoolOrNull } from "@/app/api/_shared/postgres-server";

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

function withBase(pathname: string): string {
  const origin = resolveOrigin();
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  return `${origin}${basePath}${pathname}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: withBase("/"),
      changeFrequency: "hourly",
      priority: 1,
      lastModified: new Date(),
    },
    {
      url: withBase("/global-issues"),
      changeFrequency: "hourly",
      priority: 0.8,
      lastModified: new Date(),
    },
    {
      url: withBase("/source-transfer"),
      changeFrequency: "hourly",
      priority: 0.8,
      lastModified: new Date(),
    },
    {
      url: withBase("/timeline"),
      changeFrequency: "hourly",
      priority: 0.8,
      lastModified: new Date(),
    },
    {
      url: withBase("/search"),
      changeFrequency: "daily",
      priority: 0.6,
      lastModified: new Date(),
    },
  ];

  const postgres = getPostgresPoolOrNull();
  if (!postgres) {
    return staticEntries;
  }

  const { rows } = await postgres.query<{ id: number; updated_at: string }>(
    `
    select id, max(created_at)::text as updated_at
    from topics
    where created_at >= now() - interval '7 days'
    group by id
    order by max(created_at) desc
    limit 500
    `,
  );

  const topicEntries: MetadataRoute.Sitemap = rows.map((row) => ({
    url: withBase(`/topic/${row.id}`),
    changeFrequency: "hourly",
    priority: 0.5,
    lastModified: row.updated_at,
  }));

  return [...staticEntries, ...topicEntries];
}
