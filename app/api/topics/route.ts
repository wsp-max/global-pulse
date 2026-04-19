import { NextResponse } from "next/server";
import { SOURCES, getRegionById } from "@global-pulse/shared";
import { mapTopicRow, type TopicRow } from "../_shared/mappers";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";

const PERIOD_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "7d": 168,
};
type Scope = "community" | "news" | "mixed";

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

function periodStartIso(period: string): string {
  const hours = PERIOD_HOURS[period] ?? 24;
  const start = new Date(Date.now() - hours * 60 * 60 * 1000);
  return start.toISOString();
}

function normalizeTopicKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

interface BatchSelectionRow {
  selected_created_at: string | null;
  is_fresh: boolean;
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/topics", () => getTopics(request));
}

async function getTopics(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? "kr";
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const offset = Number(searchParams.get("offset") ?? 0);
  const sort = searchParams.get("sort") ?? "heat";
  const period = searchParams.get("period") ?? "24h";
  const scope = parseScope(searchParams.get("scope"));
  const startIso = periodStartIso(period);
  const sortColumn =
    sort === "sentiment"
      ? "sentiment"
      : sort === "recent"
        ? "created_at"
        : sort === "diverse"
          ? "(coalesce(heat_score, 0) * coalesce(source_diversity, 0))"
          : "heat_score";

  const postgres = getPostgresPoolOrNull();
  if (postgres) {
    const sourceIds = sourceIdsForRegionByScope(region, scope);

    try {
      const batchSelectionResult = await postgres.query<BatchSelectionRow>(
        `
        with batch_candidates as (
          select
                max(created_at) filter (where period_end >= $2 and source_ids && $3::text[] and scope = $4) as latest_fresh_created_at,
                max(created_at) filter (where source_ids && $3::text[] and scope = $4) as latest_any_created_at
              from topics
              where region_id = $1
        )
        select
          coalesce(latest_fresh_created_at, latest_any_created_at) as selected_created_at,
          latest_fresh_created_at is not null as is_fresh
        from batch_candidates
        `,
        [region, startIso, sourceIds, scope],
      );

      const selectedBatchCreatedAt = batchSelectionResult.rows[0]?.selected_created_at ?? null;
      const isFresh = batchSelectionResult.rows[0]?.is_fresh ?? false;
      let dataState: "fresh" | "stale" | "empty" | "partially-stale" = selectedBatchCreatedAt
        ? isFresh
          ? "fresh"
          : "stale"
        : "empty";

      const [topicsResult, countResult, snapshotResult] = await Promise.all([
        postgres.query<TopicRow>(
          `
          with filtered as (
            select
              id,region_id,name_ko,name_en,summary_ko,summary_en,sample_titles,keywords,sentiment,category,entities,aliases,canonical_key,embedding_json,heat_score,heat_score_display,
              post_count,total_views,total_likes,total_comments,source_ids,raw_post_ids,burst_z,lifecycle_stage,source_diversity,dominant_source_share,representative_excerpts,scope,rank,period_start,period_end,
              null::float as velocity_per_hour,
              null::float as acceleration,
              null::float as spread_score,
              null::jsonb as propagation_timeline,
              null::jsonb as propagation_edges,
              null::float[] as mini_trend,
              created_at
            from topics
            where region_id = $1
              and source_ids && $2::text[]
              and scope = $6
              and (
                $3::timestamptz is not null
                and created_at between $3::timestamptz - interval '1 second'
                and $3::timestamptz + interval '1 second'
              )
          ),
          dedup as (
            select distinct on (lower(coalesce(name_en, name_ko)))
              *
            from filtered
            order by lower(coalesce(name_en, name_ko)), period_end desc, created_at desc, heat_score desc
          )
          select
            id,region_id,name_ko,name_en,summary_ko,summary_en,sample_titles,keywords,sentiment,category,entities,aliases,canonical_key,embedding_json,heat_score,heat_score_display,
            post_count,total_views,total_likes,total_comments,source_ids,raw_post_ids,burst_z,lifecycle_stage,source_diversity,dominant_source_share,representative_excerpts,scope,rank,period_start,period_end,
            velocity_per_hour,acceleration,spread_score,propagation_timeline,propagation_edges,
            null::float[] as mini_trend
          from dedup
          order by ${sortColumn} desc nulls last, period_end desc
          offset $4
          limit $5
          `,
          [region, sourceIds, selectedBatchCreatedAt, offset, limit, scope],
        ),
        postgres.query<{ total: string | number }>(
          `
          with filtered as (
            select name_en, name_ko, period_end, created_at, heat_score
            from topics
            where region_id = $1
              and source_ids && $2::text[]
              and scope = $4
              and (
                $3::timestamptz is not null
                and created_at between $3::timestamptz - interval '1 second'
                and $3::timestamptz + interval '1 second'
              )
          ),
          dedup as (
            select distinct on (lower(coalesce(name_en, name_ko)))
              *
            from filtered
            order by lower(coalesce(name_en, name_ko)), period_end desc, created_at desc, heat_score desc
          )
          select count(*) as total
          from dedup
          `,
          [region, sourceIds, selectedBatchCreatedAt, scope],
        ),
        postgres.query(
          `
          select *
          from region_snapshots
          where region_id = $1
            and scope = $2
          order by snapshot_at desc
          limit 1
          `,
          [region, scope],
        ),
      ]);

      const topicRows = topicsResult.rows;
      let supplementedFromHistory = 0;

      if (selectedBatchCreatedAt && topicRows.length < Math.min(10, limit)) {
        const supplementalResult = await postgres.query<TopicRow>(
          `
          with history as (
            select
              id,region_id,name_ko,name_en,summary_ko,summary_en,sample_titles,keywords,sentiment,category,entities,aliases,canonical_key,embedding_json,heat_score,heat_score_display,
              post_count,total_views,total_likes,total_comments,source_ids,raw_post_ids,burst_z,lifecycle_stage,source_diversity,dominant_source_share,representative_excerpts,scope,rank,period_start,period_end,
              null::float as velocity_per_hour,
              null::float as acceleration,
              null::float as spread_score,
              null::jsonb as propagation_timeline,
              null::jsonb as propagation_edges,
              null::float[] as mini_trend,
              created_at
            from topics
            where region_id = $1
              and source_ids && $2::text[]
              and scope = $4
              and created_at < $3::timestamptz - interval '1 second'
          ),
          dedup as (
            select distinct on (lower(coalesce(name_en, name_ko)))
              *
            from history
            order by lower(coalesce(name_en, name_ko)), created_at desc, heat_score desc
          )
          select
            id,region_id,name_ko,name_en,summary_ko,summary_en,sample_titles,keywords,sentiment,category,entities,aliases,canonical_key,embedding_json,heat_score,heat_score_display,
            post_count,total_views,total_likes,total_comments,source_ids,raw_post_ids,burst_z,lifecycle_stage,source_diversity,dominant_source_share,representative_excerpts,scope,rank,period_start,period_end,
            velocity_per_hour,acceleration,spread_score,propagation_timeline,propagation_edges,
            null::float[] as mini_trend
          from dedup
          order by ${sortColumn} desc nulls last, period_end desc
          limit $5
          `,
          [region, sourceIds, selectedBatchCreatedAt, scope, Math.max(0, limit - topicRows.length)],
        );

        const existingKeys = new Set(
          topicRows.map((row) =>
            (row.name_en || row.name_ko || "")
              .normalize("NFKC")
              .toLowerCase()
              .replace(/\s+/g, " ")
              .trim(),
          ),
        );

        for (const row of supplementalResult.rows) {
          if (topicRows.length >= limit) {
            break;
          }
          const key = (row.name_en || row.name_ko || "")
            .normalize("NFKC")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
          if (key && !existingKeys.has(key)) {
            existingKeys.add(key);
            topicRows.push(row);
            supplementedFromHistory += 1;
          }
        }
      }

      if (supplementedFromHistory > 0 && topicRows.length >= Math.min(10, limit)) {
        dataState = "partially-stale";
      }

      const sortedForDedupe = [...topicRows].sort((left, right) => {
        const heatGap = Number(right.heat_score ?? 0) - Number(left.heat_score ?? 0);
        if (heatGap !== 0) {
          return heatGap;
        }
        const leftPeriod = new Date(left.period_end).getTime();
        const rightPeriod = new Date(right.period_end).getTime();
        return rightPeriod - leftPeriod;
      });

      const dedupedMap = new Map<string, TopicRow>();
      for (const row of sortedForDedupe) {
        const canonical = normalizeTopicKey(row.canonical_key);
        const fallback = normalizeTopicKey(row.name_ko);
        const key = canonical || fallback || normalizeTopicKey(row.name_en);
        if (!key || dedupedMap.has(key)) {
          continue;
        }
        dedupedMap.set(key, row);
      }

      const dedupedRows = [...dedupedMap.values()];
      const dedupedCount = Math.max(0, topicRows.length - dedupedRows.length);

      return NextResponse.json({
        topics: dedupedRows.map(mapTopicRow),
        total: Number(countResult.rows[0]?.total ?? 0),
        region: getRegionById(region),
        snapshot: snapshotResult.rows[0] ?? null,
        meta: {
          limit,
          offset,
          sort,
          period,
          scope,
          periodStart: startIso,
          dataState,
          supplementedFromHistory,
          dedupedCount,
          selectedBatchCreatedAt,
        },
        stale: dataState === "stale" || dataState === "partially-stale",
        configured: true,
        provider: "postgres",
        scope,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : String(error),
          topics: [],
          total: 0,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    topics: [],
    total: 0,
    region: getRegionById(region),
    snapshot: null,
    meta: { limit, offset, sort, period },
    scope,
    configured: false,
    provider: "none",
    lastUpdated: new Date().toISOString(),
  });
}








