import { NextResponse } from "next/server";
import { getAllRegions } from "@global-pulse/shared";
import { mapTopicRow, type TopicRow } from "../_shared/mappers";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/regions", () => getRegions());
}

async function getRegions() {
  const regions = getAllRegions();
  const postgres = getPostgresPoolOrNull();

  if (postgres) {
    const regionRows = await Promise.all(
      regions.map(async (region) => {
        const [snapshotResult, topicsResult] = await Promise.all([
          postgres.query<{
            total_heat_score: number | string | null;
            active_topics: number | string | null;
            avg_sentiment: number | string | null;
            top_keywords: string[] | null;
            sources_active: number | string | null;
            sources_total: number | string | null;
            snapshot_at: string | null;
          }>(
            `
            select
              total_heat_score,
              active_topics,
              avg_sentiment,
              top_keywords,
              sources_active,
              sources_total,
              snapshot_at
            from region_snapshots
            where region_id = $1
            order by snapshot_at desc
            limit 1
            `,
            [region.id],
          ),
          postgres.query<TopicRow>(
            `
            with latest_batch as (
              select max(created_at) as latest_created_at
              from topics
              where region_id = $1
            )
            select
              id,region_id,name_ko,name_en,summary_ko,summary_en,keywords,sentiment,heat_score,
              post_count,total_views,total_likes,total_comments,source_ids,rank,period_start,period_end
            from topics
            where region_id = $1
              and created_at = (select latest_created_at from latest_batch)
            order by heat_score desc, rank asc nulls last
            limit 3
            `,
            [region.id],
          ),
        ]);

        const snapshot = snapshotResult.rows[0];
        return {
          ...region,
          totalHeatScore: Number(snapshot?.total_heat_score ?? 0),
          activeTopics: Number(snapshot?.active_topics ?? 0),
          avgSentiment: Number(snapshot?.avg_sentiment ?? 0),
          topKeywords: snapshot?.top_keywords ?? [],
          sourcesActive: Number(snapshot?.sources_active ?? 0),
          sourcesTotal: Number(snapshot?.sources_total ?? 0),
          snapshotAt: snapshot?.snapshot_at ?? null,
          topTopics: topicsResult.rows.map(mapTopicRow),
        };
      }),
    );

    return NextResponse.json({
      regions: regionRows,
      configured: true,
      provider: "postgres",
    });
  }

  return NextResponse.json({
    regions: regions.map((region) => ({
      ...region,
      totalHeatScore: 0,
      activeTopics: 0,
      avgSentiment: 0,
      topKeywords: [],
      sourcesActive: 0,
      sourcesTotal: 0,
      topTopics: [],
    })),
    configured: false,
    provider: "none",
  });
}


