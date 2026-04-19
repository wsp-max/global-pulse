import { NextResponse } from "next/server";
import { SOURCES, getRegionById } from "@global-pulse/shared";
import { mapTopicRow, type TopicRow } from "../../_shared/mappers";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";

type Scope = "community" | "news";

interface BatchSelectionRow {
  selected_created_at: string | null;
  is_fresh: boolean;
}

function sourceIdsForRegionByScope(regionId: string, scope: Scope): string[] {
  return SOURCES.filter((source) => {
    if (source.regionId !== regionId) {
      return false;
    }
    if (scope === "community") {
      return source.type === "community" || source.type === "sns";
    }
    return source.type === "news";
  }).map((source) => source.id);
}

function deriveTopKeywords(topics: ReturnType<typeof mapTopicRow>[]): string[] {
  const counts = new Map<string, number>();
  for (const topic of topics) {
    for (const keyword of topic.keywords ?? []) {
      const trimmed = keyword.trim();
      if (!trimmed) continue;
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([keyword]) => keyword);
}

async function fetchRegionDashboardRow(regionId: string, scope: Scope) {
  const postgres = getPostgresPoolOrNull();
  const region = getRegionById(regionId);
  if (!postgres || !region) {
    return null;
  }

  const sourceIds = sourceIdsForRegionByScope(regionId, scope);
  const [snapshotResult, batchSelectionResult] = await Promise.all([
    postgres.query<{
      sources_total: number | string | null;
      snapshot_at: string | null;
    }>(
      `
      select sources_total, snapshot_at
      from region_snapshots
      where region_id = $1
        and scope = $2
      order by snapshot_at desc
      limit 1
      `,
      [regionId, scope],
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
      [regionId, sourceIds, scope],
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
        post_count,total_views,total_likes,total_comments,source_ids,scope,rank,period_start,period_end
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
      limit 8
      `,
      [regionId, sourceIds, selectedBatchCreatedAt, scope],
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
      [regionId, sourceIds, selectedBatchCreatedAt, scope],
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
    scope,
    topTopics,
  };
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/regions/compare", () => getRegionCompare(request));
}

async function getRegionCompare(request: Request) {
  const { searchParams } = new URL(request.url);
  const regionId = (searchParams.get("regionId") ?? "kr").trim().toLowerCase();

  const region = getRegionById(regionId);
  if (!region) {
    return NextResponse.json({ error: `Unknown regionId: ${regionId}` }, { status: 400 });
  }

  const postgres = getPostgresPoolOrNull();
  if (!postgres) {
    return NextResponse.json({
      regionId,
      community: null,
      news: null,
      overlap: {
        sharedTopicCount: 0,
        sharedCanonicalKeys: [],
        lagSummary: { avgMinutes: null, minMinutes: null, maxMinutes: null },
      },
      configured: false,
      lastUpdated: new Date().toISOString(),
    });
  }

  const [community, news, overlapResult] = await Promise.all([
    fetchRegionDashboardRow(regionId, "community"),
    fetchRegionDashboardRow(regionId, "news"),
    postgres.query<{
      canonical_key: string | null;
      lag_minutes: number | null;
    }>(
      `
      select io.canonical_key, io.lag_minutes
      from issue_overlaps io
      join topics tc on tc.id = io.community_topic_id
      join topics tn on tn.id = io.news_topic_id
      where tc.region_id = $1
        and tn.region_id = $1
      order by io.detected_at desc
      limit 500
      `,
      [regionId],
    ),
  ]);

  const lagValues = overlapResult.rows
    .map((row) => row.lag_minutes)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const sharedCanonicalKeys = [...new Set(overlapResult.rows.map((row) => row.canonical_key).filter(Boolean))].slice(
    0,
    20,
  ) as string[];

  return NextResponse.json({
    regionId,
    community,
    news,
    overlap: {
      sharedTopicCount: overlapResult.rows.length,
      sharedCanonicalKeys,
      lagSummary: {
        avgMinutes: lagValues.length > 0 ? Number((lagValues.reduce((sum, value) => sum + value, 0) / lagValues.length).toFixed(2)) : null,
        minMinutes: lagValues.length > 0 ? Math.min(...lagValues) : null,
        maxMinutes: lagValues.length > 0 ? Math.max(...lagValues) : null,
      },
    },
    configured: true,
    lastUpdated: new Date().toISOString(),
  });
}
