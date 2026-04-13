import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/stats", () => getStats());
}

async function getStats() {
  const postgres = getPostgresPoolOrNull();
  if (postgres) {
    const activeWindow = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    const { rows } = await postgres.query<{
      total_posts: string | number;
      total_topics: string | number;
      total_global_topics: string | number;
      active_regions: string | number;
      collected_sources: string | number;
    }>(
      `
      select
        (select count(*) from raw_posts) as total_posts,
        (select count(*) from topics) as total_topics,
        (select count(*) from global_topics) as total_global_topics,
        (select count(*) from regions where is_active = true) as active_regions,
        (select count(*) from sources where last_scraped_at >= $1) as collected_sources
      `,
      [activeWindow],
    );

    const row = rows[0];
    return NextResponse.json({
      totalPosts: Number(row?.total_posts ?? 0),
      totalTopics: Number(row?.total_topics ?? 0),
      totalGlobalTopics: Number(row?.total_global_topics ?? 0),
      activeRegions: Number(row?.active_regions ?? 0),
      collectedSources: Number(row?.collected_sources ?? 0),
      configured: true,
      provider: "postgres",
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    totalPosts: 0,
    totalTopics: 0,
    totalGlobalTopics: 0,
    activeRegions: 0,
    collectedSources: 0,
    configured: false,
    provider: "none",
    timestamp: new Date().toISOString(),
  });
}


