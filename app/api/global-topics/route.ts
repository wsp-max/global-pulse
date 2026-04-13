import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";
import { mapGlobalTopicRow, type GlobalTopicRow } from "../_shared/mappers";

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/global-topics", () => getGlobalTopics(request));
}

async function getGlobalTopics(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);
  const minRegions = Math.max(Number(searchParams.get("minRegions") ?? 2), 1);

  const postgres = getPostgresPoolOrNull();
  if (postgres) {
    try {
      const { rows } = await postgres.query<GlobalTopicRow>(
        `
        select
          id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
          topic_ids,total_heat_score,first_seen_region,first_seen_at,created_at
        from global_topics
        where expires_at is null or expires_at > now()
        order by total_heat_score desc
        limit 100
        `,
      );

      const mapped = rows.map(mapGlobalTopicRow).filter((topic) => topic.regions.length >= minRegions);

      return NextResponse.json({
        globalTopics: mapped.slice(0, limit),
        total: mapped.length,
        meta: { limit, minRegions },
        configured: true,
        provider: "postgres",
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : String(error),
          globalTopics: [],
          total: 0,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    globalTopics: [],
    total: 0,
    meta: {
      limit,
      minRegions,
    },
    configured: false,
    provider: "none",
    lastUpdated: new Date().toISOString(),
  });
}


