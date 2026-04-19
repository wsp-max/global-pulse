import { NextResponse } from "next/server";
import { SOURCES, getAllRegions } from "@global-pulse/shared";
import { mapTopicRow, type TopicRow } from "../_shared/mappers";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";

interface BatchSelectionRow {
  selected_created_at: string | null;
  is_fresh: boolean;
}

function deriveTopKeywords(topics: ReturnType<typeof mapTopicRow>[]): string[] {
  const counts = new Map<string, number>();
  for (const topic of topics) {
    for (const keyword of topic.keywords ?? []) {
      const trimmed = keyword.trim();
      if (!trimmed) {
        continue;
      }
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([keyword]) => keyword);
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/regions", () => getRegions());
}

async function getRegions() {
  const regions = getAllRegions();
  const postgres = getPostgresPoolOrNull();

  if (postgres) {
    const regionRows = await Promise.all(
      regions.map(async (region) => {
        const sourceIds = SOURCES.filter((source) => source.regionId === region.id).map((source) => source.id);
        const [snapshotResult, batchSelectionResult] = await Promise.all([
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
          postgres.query<BatchSelectionRow>(
            `
            with batch_candidates as (
              select
                max(created_at) filter (
                  where period_end >= now() - interval '24 hours'
                    and source_ids && $2::text[]
                ) as latest_fresh_created_at,
                max(created_at) filter (where source_ids && $2::text[]) as latest_any_created_at
              from topics
              where region_id = $1
            )
            select
              coalesce(latest_fresh_created_at, latest_any_created_at) as selected_created_at,
              latest_fresh_created_at is not null as is_fresh
            from batch_candidates
            `,
            [region.id, sourceIds],
          ),
        ]);

        const selectedBatchCreatedAt = batchSelectionResult.rows[0]?.selected_created_at ?? null;
        const isFresh = batchSelectionResult.rows[0]?.is_fresh ?? false;
        const dataState = selectedBatchCreatedAt ? (isFresh ? "fresh" : "stale") : "empty";

        const [topicsResult, metricsResult] = await Promise.all([
          postgres.query<TopicRow>(
            `
            select
              id,region_id,name_ko,name_en,summary_ko,summary_en,keywords,sentiment,heat_score,
              post_count,total_views,total_likes,total_comments,source_ids,rank,period_start,period_end
            from topics
            where region_id = $1
              and source_ids && $2::text[]
              and (
                $3::timestamptz is not null
                and created_at between $3::timestamptz - interval '1 second'
                and $3::timestamptz + interval '1 second'
              )
            order by heat_score desc, rank asc nulls last
            limit 8
            `,
            [region.id, sourceIds, selectedBatchCreatedAt],
          ),
          postgres.query<{
            total_heat_score: number | string | null;
            active_topics: number | string | null;
            avg_sentiment: number | string | null;
            sources_active: number | string | null;
          }>(
            `
            with filtered as (
              select heat_score, sentiment, source_ids
              from topics
              where region_id = $1
                and source_ids && $2::text[]
                and (
                  $3::timestamptz is not null
                  and created_at between $3::timestamptz - interval '1 second'
                  and $3::timestamptz + interval '1 second'
                )
            )
            select
              coalesce(sum(heat_score), 0) as total_heat_score,
              count(*) as active_topics,
              coalesce(avg(sentiment), 0) as avg_sentiment,
              coalesce(count(distinct sid), 0) as sources_active
            from filtered
            left join lateral unnest(coalesce(source_ids, '{}'::text[])) as src(sid) on true
            `,
            [region.id, sourceIds, selectedBatchCreatedAt],
          ),
        ]);

        const snapshot = snapshotResult.rows[0];
        const metrics = metricsResult.rows[0];
        const topTopics = topicsResult.rows.map(mapTopicRow);
        const hasMetrics = Number(metrics?.active_topics ?? 0) > 0;
        return {
          ...region,
          totalHeatScore: Number(hasMetrics ? metrics?.total_heat_score ?? 0 : 0),
          activeTopics: Number(hasMetrics ? metrics?.active_topics ?? 0 : 0),
          avgSentiment: Number(hasMetrics ? metrics?.avg_sentiment ?? 0 : 0),
          topKeywords: hasMetrics && topTopics.length > 0 ? deriveTopKeywords(topTopics) : [],
          sourcesActive: Number(hasMetrics ? metrics?.sources_active ?? 0 : 0),
          sourcesTotal: Number(snapshot?.sources_total ?? sourceIds.length),
          snapshotAt: snapshot?.snapshot_at ?? selectedBatchCreatedAt ?? null,
          dataState,
          stale: dataState === "stale",
          topTopics,
        };
      }),
    );

    return NextResponse.json({
      regions: regionRows,
      configured: true,
      provider: "postgres",
      lastUpdated: new Date().toISOString(),
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
    lastUpdated: new Date().toISOString(),
  });
}



