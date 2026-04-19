import { NextResponse } from "next/server";
import { SOURCES, getAllRegions } from "@global-pulse/shared";
import { mapTopicRow, type TopicRow } from "../_shared/mappers";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";

type Scope = "community" | "news" | "mixed";

interface BatchSelectionRow {
  selected_created_at: string | null;
  is_fresh: boolean;
}

interface MiniTrendRow {
  topic_name: string;
  bucket_at: string;
  heat_score: number | string | null;
}

type RegionDataState = "fresh" | "stale" | "empty" | "partially-stale";

function parseScope(value: string | null): Scope {
  if (value === "news" || value === "mixed") {
    return value;
  }
  return "community";
}

function sourceIdsForRegionByScope(regionId: string, scope: Scope): string[] {
  return SOURCES.filter((source) => {
    if (source.regionId !== regionId) {
      return false;
    }

    if (scope === "community") {
      return source.type === "community" || source.type === "sns";
    }

    if (scope === "news") {
      return source.type === "news";
    }

    return true;
  }).map((source) => source.id);
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
  return withApiRequestLog(request, "/api/regions", () => getRegions(request));
}

async function getRegions(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = parseScope(searchParams.get("scope"));
  const regions = getAllRegions();
  const postgres = getPostgresPoolOrNull();

  if (postgres) {
    const regionRows = await Promise.all(
      regions.map(async (region) => {
        const sourceIds = sourceIdsForRegionByScope(region.id, scope);
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
              and scope = $2
            order by snapshot_at desc
            limit 1
            `,
            [region.id, scope],
          ),
          postgres.query<BatchSelectionRow>(
            `
            with batch_candidates as (
              select
                max(created_at) filter (
                  where period_end >= now() - interval '24 hours'
                    and source_ids && $2::text[]
                    and scope = $3
                ) as latest_fresh_created_at,
                max(created_at) filter (where source_ids && $2::text[] and scope = $3) as latest_any_created_at
              from topics
              where region_id = $1
            )
            select
              coalesce(latest_fresh_created_at, latest_any_created_at) as selected_created_at,
              latest_fresh_created_at is not null as is_fresh
            from batch_candidates
            `,
            [region.id, sourceIds, scope],
          ),
        ]);

        const selectedBatchCreatedAt = batchSelectionResult.rows[0]?.selected_created_at ?? null;
        const isFresh = batchSelectionResult.rows[0]?.is_fresh ?? false;
        let dataState: RegionDataState = selectedBatchCreatedAt ? (isFresh ? "fresh" : "stale") : "empty";

        const [topicsResult, metricsResult] = await Promise.all([
          postgres.query<TopicRow>(
            `
            select
              id,region_id,name_ko,name_en,summary_ko,summary_en,sample_titles,keywords,sentiment,category,entities,aliases,canonical_key,embedding_json,heat_score,heat_score_display,
              post_count,total_views,total_likes,total_comments,source_ids,raw_post_ids,burst_z,lifecycle_stage,source_diversity,dominant_source_share,scope,rank,period_start,period_end,
              null::float as velocity_per_hour,
              null::float as acceleration,
              null::float as spread_score,
              null::jsonb as propagation_timeline,
              null::jsonb as propagation_edges,
              null::float[] as mini_trend
            from topics
            where region_id = $1
              and source_ids && $2::text[]
              and scope = $4
              and (
                $3::timestamptz is not null
                and created_at between $3::timestamptz - interval '1 second'
                and $3::timestamptz + interval '1 second'
              )
            order by heat_score desc, rank asc nulls last
            limit 12
            `,
            [region.id, sourceIds, selectedBatchCreatedAt, scope],
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
                and scope = $4
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
            [region.id, sourceIds, selectedBatchCreatedAt, scope],
          ),
        ]);

        const snapshot = snapshotResult.rows[0];
        const metrics = metricsResult.rows[0];
        const dedupeByLabel = (rows: TopicRow[]): TopicRow[] => {
          const seen = new Set<string>();
          const output: TopicRow[] = [];
          for (const row of rows) {
            const key = (row.name_en || row.name_ko || "")
              .normalize("NFKC")
              .toLowerCase()
              .replace(/\s+/g, " ")
              .trim();
            if (!key || seen.has(key)) {
              continue;
            }
            seen.add(key);
            output.push(row);
          }
          return output;
        };

        const mergedTopicRows = dedupeByLabel(topicsResult.rows);
        let supplementedFromHistory = 0;

        if (selectedBatchCreatedAt && mergedTopicRows.length < 12) {
          const supplementalResult = await postgres.query<TopicRow>(
            `
            with history as (
              select
                id,region_id,name_ko,name_en,summary_ko,summary_en,sample_titles,keywords,sentiment,category,entities,aliases,canonical_key,embedding_json,heat_score,heat_score_display,
                post_count,total_views,total_likes,total_comments,source_ids,raw_post_ids,burst_z,lifecycle_stage,source_diversity,dominant_source_share,scope,rank,period_start,period_end,
                null::float as velocity_per_hour,
                null::float as acceleration,
                null::float as spread_score,
                null::jsonb as propagation_timeline,
                null::jsonb as propagation_edges,
              null::float[] as mini_trend
              from topics
              where region_id = $1
                and source_ids && $2::text[]
                and scope = $4
                and created_at < $3::timestamptz - interval '1 second'
              order by created_at desc, heat_score desc, rank asc nulls last
              limit 24
            )
            select *
            from history
            `,
            [region.id, sourceIds, selectedBatchCreatedAt, scope],
          );

          const supplementalRows = dedupeByLabel(supplementalResult.rows);
          for (const row of supplementalRows) {
            if (mergedTopicRows.length >= 12) {
              break;
            }
            const key = (row.name_en || row.name_ko || "")
              .normalize("NFKC")
              .toLowerCase()
              .replace(/\s+/g, " ")
              .trim();
            const exists = mergedTopicRows.some((item) => {
              const itemKey = (item.name_en || item.name_ko || "")
                .normalize("NFKC")
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();
              return itemKey === key;
            });
            if (!exists) {
              mergedTopicRows.push(row);
              supplementedFromHistory += 1;
            }
          }
        }

        if (supplementedFromHistory > 0 && mergedTopicRows.length >= 10) {
          dataState = "partially-stale";
        }

        const topTopics = mergedTopicRows.map(mapTopicRow);
        const timelineTopicNames = topTopics.map((topic) => topic.nameEn).filter(Boolean);
        const trendRows =
          timelineTopicNames.length > 0
            ? await postgres.query<MiniTrendRow>(
                `
                select
                  topic_name,
                  to_char(date_trunc('hour', recorded_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as bucket_at,
                  avg(heat_score) as heat_score
                from heat_history
                where region_id = $1
                  and topic_name = any($2::text[])
                  and recorded_at >= now() - interval '24 hours'
                group by topic_name, date_trunc('hour', recorded_at)
                order by topic_name asc, date_trunc('hour', recorded_at) asc
                `,
                [region.id, timelineTopicNames],
              )
            : { rows: [] as MiniTrendRow[] };

        const trendByTopic = new Map<string, number[]>();
        for (const row of trendRows.rows) {
          const list = trendByTopic.get(row.topic_name) ?? [];
          list.push(Number(row.heat_score ?? 0));
          trendByTopic.set(row.topic_name, list);
        }

        const enrichedTopTopics = topTopics.map((topic) => ({
          ...topic,
          miniTrend: (trendByTopic.get(topic.nameEn) ?? []).slice(-8),
        }));
        const hasMetrics = Number(metrics?.active_topics ?? 0) > 0;

        return {
          ...region,
          totalHeatScore: Number(hasMetrics ? metrics?.total_heat_score ?? 0 : 0),
          activeTopics: Number(hasMetrics ? metrics?.active_topics ?? 0 : 0),
          avgSentiment: Number(hasMetrics ? metrics?.avg_sentiment ?? 0 : 0),
          topKeywords: hasMetrics && enrichedTopTopics.length > 0 ? deriveTopKeywords(enrichedTopTopics) : [],
          sourcesActive: Number(hasMetrics ? metrics?.sources_active ?? 0 : 0),
          sourcesTotal: Number(snapshot?.sources_total ?? sourceIds.length),
          snapshotAt: snapshot?.snapshot_at ?? selectedBatchCreatedAt ?? null,
          dataState,
          supplementedFromHistory,
          stale: dataState === "stale" || dataState === "partially-stale",
          scope,
          topTopics: enrichedTopTopics,
        };
      }),
    );

    return NextResponse.json({
      regions: regionRows,
      scope,
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
      scope,
      topTopics: [],
    })),
    scope,
    configured: false,
    provider: "none",
    lastUpdated: new Date().toISOString(),
  });
}






