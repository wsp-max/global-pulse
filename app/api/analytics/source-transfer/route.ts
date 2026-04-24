import { NextResponse } from "next/server";
import { getAllRegions } from "@global-pulse/shared";
import type { SourceTransferDirection } from "@/lib/types/api";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";

export const dynamic = "force-dynamic";

interface SummaryRow {
  total_events: number | string;
  unique_pairs: number | string;
  community_lead_count: number | string;
  news_lead_count: number | string;
  tie_count: number | string;
  median_lag_minutes: number | string | null;
  p90_lag_minutes: number | string | null;
  latest_detected_at: string | null;
}

interface PairRow {
  region_id: string;
  leader: "community" | "news" | "tie";
  community_topic_id: number | string;
  community_topic_name_ko: string | null;
  community_topic_name_en: string | null;
  news_topic_id: number | string;
  news_topic_name_ko: string | null;
  news_topic_name_en: string | null;
  event_count: number | string;
  first_detected_at: string;
  last_detected_at: string;
  avg_lag_minutes: number | string | null;
  latest_lag_minutes: number | string | null;
  avg_cosine: number | string | null;
}

interface TrendRow {
  bucket: string;
  event_count: number | string;
  avg_lag_minutes: number | string | null;
  community_lead_count: number | string;
  news_lead_count: number | string;
  tie_count: number | string;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDirection(value: string | null): SourceTransferDirection {
  if (value === "news_to_community" || value === "both") {
    return value;
  }
  return "community_to_news";
}

function parseHours(value: string | null): number {
  const parsed = Number(value ?? 24);
  if (!Number.isFinite(parsed)) {
    return 24;
  }
  return Math.max(1, Math.min(Math.trunc(parsed), 168));
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 30);
  if (!Number.isFinite(parsed)) {
    return 30;
  }
  return Math.max(1, Math.min(Math.trunc(parsed), 200));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.trunc(parsed));
}

function parseRegion(value: string | null): string {
  const raw = (value ?? "all").trim().toLowerCase();
  if (!raw || raw === "all") {
    return "all";
  }
  const regionIds = new Set(getAllRegions().map((region) => region.id));
  return regionIds.has(raw) ? raw : "all";
}

function buildFilteredCte() {
  return `
    with filtered as (
      select *
      from issue_overlap_events
      where detected_at >= now() - ($1::text || ' hours')::interval
        and ($2::text = 'all' or region_id = $2::text)
        and (
          ($3::text = 'community_to_news' and leader = 'community')
          or ($3::text = 'news_to_community' and leader = 'news')
          or ($3::text = 'both' and leader in ('community', 'news', 'tie'))
        )
    )
  `;
}

function buildPairKey(regionId: string, communityTopicId: number, newsTopicId: number): string {
  return `${regionId}:${communityTopicId}:${newsTopicId}`;
}

function toLabel(nameKo: string | null | undefined, nameEn: string | null | undefined, fallback: string): string {
  const ko = (nameKo ?? "").trim();
  const en = (nameEn ?? "").trim();
  if (ko) return ko;
  if (en) return en;
  return fallback;
}

function buildTrendSeries(rows: TrendRow[], hours: number) {
  const map = new Map<number, TrendRow>();
  for (const row of rows) {
    const ms = new Date(row.bucket).getTime();
    if (Number.isFinite(ms)) {
      map.set(ms, row);
    }
  }

  const end = new Date();
  end.setUTCMinutes(0, 0, 0);
  const start = new Date(end.getTime() - (hours - 1) * 60 * 60 * 1000);

  const series: Array<{
    hour: string;
    eventCount: number;
    avgLagMinutes: number | null;
    communityLeadCount: number;
    newsLeadCount: number;
    tieCount: number;
  }> = [];

  for (let index = 0; index < hours; index += 1) {
    const bucket = new Date(start.getTime() + index * 60 * 60 * 1000);
    const bucketMs = bucket.getTime();
    const row = map.get(bucketMs);
    series.push({
      hour: bucket.toISOString(),
      eventCount: row ? toNumber(row.event_count) : 0,
      avgLagMinutes: row ? toNullableNumber(row.avg_lag_minutes) : null,
      communityLeadCount: row ? toNumber(row.community_lead_count) : 0,
      newsLeadCount: row ? toNumber(row.news_lead_count) : 0,
      tieCount: row ? toNumber(row.tie_count) : 0,
    });
  }

  return series;
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/analytics/source-transfer", async () => {
    const { searchParams } = new URL(request.url);
    const direction = parseDirection(searchParams.get("direction"));
    const hours = parseHours(searchParams.get("hours"));
    const region = parseRegion(searchParams.get("region"));
    const limit = parseLimit(searchParams.get("limit"));
    const offset = parseOffset(searchParams.get("offset"));

    const postgres = getPostgresPoolOrNull();
    if (!postgres) {
      return NextResponse.json({
        summary: {
          totalEvents: 0,
          uniquePairs: 0,
          communityLeadCount: 0,
          newsLeadCount: 0,
          tieCount: 0,
          forwardLeadCount: 0,
          forwardLeadShare: null,
          medianLagMinutes: null,
          p90LagMinutes: null,
          latestDetectedAt: null,
        },
        sankey: {
          nodes: [],
          links: [],
        },
        trendHourly: [],
        pairs: [],
        meta: {
          direction,
          hours,
          region,
          limit,
          offset,
          totalPairs: 0,
          returnedPairs: 0,
        },
        configured: false,
        provider: "none",
        lastUpdated: new Date().toISOString(),
      });
    }

    const cte = buildFilteredCte();
    const baseParams: [number, string, SourceTransferDirection] = [hours, region, direction];
    const [
      summaryResult,
      totalPairsResult,
      pairsResult,
      sankeyPairsResult,
      trendResult,
    ] = await Promise.all([
      postgres.query<SummaryRow>(
        `
        ${cte}
        select
          count(*)::int as total_events,
          count(distinct region_id || ':' || community_topic_id::text || ':' || news_topic_id::text)::int as unique_pairs,
          count(*) filter (where leader = 'community')::int as community_lead_count,
          count(*) filter (where leader = 'news')::int as news_lead_count,
          count(*) filter (where leader = 'tie')::int as tie_count,
          percentile_cont(0.5) within group (order by abs(lag_minutes))
            filter (where lag_minutes is not null) as median_lag_minutes,
          percentile_cont(0.9) within group (order by abs(lag_minutes))
            filter (where lag_minutes is not null) as p90_lag_minutes,
          max(detected_at)::text as latest_detected_at
        from filtered
        `,
        baseParams,
      ),
      postgres.query<{ total_pairs: number | string }>(
        `
        ${cte}
        select count(*)::int as total_pairs
        from (
          select 1
          from filtered
          group by region_id, community_topic_id, news_topic_id
        ) grouped
        `,
        baseParams,
      ),
      postgres.query<PairRow>(
        `
        ${cte}
        ,
        latest as (
          select distinct on (region_id, community_topic_id, news_topic_id)
            region_id,
            community_topic_id,
            news_topic_id,
            leader,
            lag_minutes as latest_lag_minutes,
            detected_at as last_detected_at,
            community_topic_name_ko,
            community_topic_name_en,
            news_topic_name_ko,
            news_topic_name_en
          from filtered
          order by region_id, community_topic_id, news_topic_id, detected_at desc, id desc
        ),
        stats as (
          select
            region_id,
            community_topic_id,
            news_topic_id,
            count(*)::int as event_count,
            min(detected_at)::text as first_detected_at,
            max(detected_at)::text as last_detected_at,
            avg(abs(lag_minutes)) filter (where lag_minutes is not null) as avg_lag_minutes,
            avg(cosine) filter (where cosine is not null) as avg_cosine
          from filtered
          group by region_id, community_topic_id, news_topic_id
        )
        select
          s.region_id,
          l.leader,
          s.community_topic_id,
          l.community_topic_name_ko,
          l.community_topic_name_en,
          s.news_topic_id,
          l.news_topic_name_ko,
          l.news_topic_name_en,
          s.event_count,
          s.first_detected_at,
          s.last_detected_at,
          s.avg_lag_minutes,
          l.latest_lag_minutes,
          s.avg_cosine
        from stats s
        join latest l
          on l.region_id = s.region_id
         and l.community_topic_id = s.community_topic_id
         and l.news_topic_id = s.news_topic_id
        order by s.event_count desc, s.last_detected_at desc
        offset $4
        limit $5
        `,
        [...baseParams, offset, limit],
      ),
      postgres.query<PairRow>(
        `
        ${cte}
        ,
        latest as (
          select distinct on (region_id, community_topic_id, news_topic_id)
            region_id,
            community_topic_id,
            news_topic_id,
            leader,
            lag_minutes as latest_lag_minutes,
            detected_at as last_detected_at,
            community_topic_name_ko,
            community_topic_name_en,
            news_topic_name_ko,
            news_topic_name_en
          from filtered
          order by region_id, community_topic_id, news_topic_id, detected_at desc, id desc
        ),
        stats as (
          select
            region_id,
            community_topic_id,
            news_topic_id,
            count(*)::int as event_count,
            min(detected_at)::text as first_detected_at,
            max(detected_at)::text as last_detected_at,
            avg(abs(lag_minutes)) filter (where lag_minutes is not null) as avg_lag_minutes,
            avg(cosine) filter (where cosine is not null) as avg_cosine
          from filtered
          group by region_id, community_topic_id, news_topic_id
        )
        select
          s.region_id,
          l.leader,
          s.community_topic_id,
          l.community_topic_name_ko,
          l.community_topic_name_en,
          s.news_topic_id,
          l.news_topic_name_ko,
          l.news_topic_name_en,
          s.event_count,
          s.first_detected_at,
          s.last_detected_at,
          s.avg_lag_minutes,
          l.latest_lag_minutes,
          s.avg_cosine
        from stats s
        join latest l
          on l.region_id = s.region_id
         and l.community_topic_id = s.community_topic_id
         and l.news_topic_id = s.news_topic_id
        order by s.event_count desc, s.last_detected_at desc
        limit $4
        `,
        [...baseParams, Math.max(24, Math.min(limit * 2, 80))],
      ),
      postgres.query<TrendRow>(
        `
        ${cte}
        select
          date_trunc('hour', detected_at)::text as bucket,
          count(*)::int as event_count,
          avg(abs(lag_minutes)) filter (where lag_minutes is not null) as avg_lag_minutes,
          count(*) filter (where leader = 'community')::int as community_lead_count,
          count(*) filter (where leader = 'news')::int as news_lead_count,
          count(*) filter (where leader = 'tie')::int as tie_count
        from filtered
        group by date_trunc('hour', detected_at)
        order by date_trunc('hour', detected_at) asc
        `,
        baseParams,
      ),
    ]);

    const summary = summaryResult.rows[0];
    const totalPairs = toNumber(totalPairsResult.rows[0]?.total_pairs);
    const communityLeadCount = toNumber(summary?.community_lead_count);
    const newsLeadCount = toNumber(summary?.news_lead_count);
    const directionalTotal = Math.max(communityLeadCount + newsLeadCount, 0);
    const forwardLeadCount =
      direction === "news_to_community"
        ? newsLeadCount
        : direction === "community_to_news"
          ? communityLeadCount
          : directionalTotal;
    const forwardLeadShare =
      direction === "both"
        ? null
        : directionalTotal > 0
          ? Number((forwardLeadCount / directionalTotal).toFixed(4))
          : null;

    const pairRows = pairsResult.rows.map((row) => {
      const communityTopicId = toNumber(row.community_topic_id);
      const newsTopicId = toNumber(row.news_topic_id);
      return {
        pairKey: buildPairKey(row.region_id, communityTopicId, newsTopicId),
        regionId: row.region_id,
        leader: row.leader,
        communityTopicId,
        communityTopicNameKo: row.community_topic_name_ko ?? "",
        communityTopicNameEn: row.community_topic_name_en ?? "",
        newsTopicId,
        newsTopicNameKo: row.news_topic_name_ko ?? "",
        newsTopicNameEn: row.news_topic_name_en ?? "",
        eventCount: toNumber(row.event_count),
        firstDetectedAt: row.first_detected_at,
        lastDetectedAt: row.last_detected_at,
        avgLagMinutes: toNullableNumber(row.avg_lag_minutes),
        latestLagMinutes: toNullableNumber(row.latest_lag_minutes),
        avgCosine: toNullableNumber(row.avg_cosine),
      };
    });

    const nodes: Array<{ id: string; label: string; scope: "community" | "news"; topicId: number }> = [];
    const links: Array<{ source: number; target: number; value: number; avgLagMinutes: number | null; pairKey: string; leader: "community" | "news" | "tie" }> = [];
    const nodeIndexById = new Map<string, number>();

    for (const row of sankeyPairsResult.rows) {
      const communityTopicId = toNumber(row.community_topic_id);
      const newsTopicId = toNumber(row.news_topic_id);
      if (communityTopicId <= 0 || newsTopicId <= 0) {
        continue;
      }

      const drawAsNewsLead = direction === "news_to_community" || (direction === "both" && row.leader === "news");
      const fromId = drawAsNewsLead ? `news:${newsTopicId}` : `community:${communityTopicId}`;
      const toId = drawAsNewsLead ? `community:${communityTopicId}` : `news:${newsTopicId}`;
      const fromScope: "community" | "news" = drawAsNewsLead ? "news" : "community";
      const toScope: "community" | "news" = drawAsNewsLead ? "community" : "news";
      const fromLabel = drawAsNewsLead
        ? toLabel(row.news_topic_name_ko, row.news_topic_name_en, `News #${newsTopicId}`)
        : toLabel(row.community_topic_name_ko, row.community_topic_name_en, `Community #${communityTopicId}`);
      const toLabelText = drawAsNewsLead
        ? toLabel(row.community_topic_name_ko, row.community_topic_name_en, `Community #${communityTopicId}`)
        : toLabel(row.news_topic_name_ko, row.news_topic_name_en, `News #${newsTopicId}`);

      if (!nodeIndexById.has(fromId)) {
        nodeIndexById.set(fromId, nodes.length);
        nodes.push({
          id: fromId,
          label: fromLabel,
          scope: fromScope,
          topicId: fromScope === "community" ? communityTopicId : newsTopicId,
        });
      }

      if (!nodeIndexById.has(toId)) {
        nodeIndexById.set(toId, nodes.length);
        nodes.push({
          id: toId,
          label: toLabelText,
          scope: toScope,
          topicId: toScope === "community" ? communityTopicId : newsTopicId,
        });
      }

      links.push({
        source: nodeIndexById.get(fromId) ?? 0,
        target: nodeIndexById.get(toId) ?? 0,
        value: Math.max(1, toNumber(row.event_count)),
        avgLagMinutes: toNullableNumber(row.avg_lag_minutes),
        pairKey: buildPairKey(row.region_id, communityTopicId, newsTopicId),
        leader: row.leader,
      });
    }

    return NextResponse.json({
      summary: {
        totalEvents: toNumber(summary?.total_events),
        uniquePairs: toNumber(summary?.unique_pairs),
        communityLeadCount,
        newsLeadCount,
        tieCount: toNumber(summary?.tie_count),
        forwardLeadCount,
        forwardLeadShare,
        medianLagMinutes: toNullableNumber(summary?.median_lag_minutes),
        p90LagMinutes: toNullableNumber(summary?.p90_lag_minutes),
        latestDetectedAt: summary?.latest_detected_at ?? null,
      },
      sankey: {
        nodes,
        links,
      },
      trendHourly: buildTrendSeries(trendResult.rows, hours),
      pairs: pairRows,
      meta: {
        direction,
        hours,
        region,
        limit,
        offset,
        totalPairs,
        returnedPairs: pairRows.length,
      },
      configured: true,
      provider: "postgres",
      lastUpdated: new Date().toISOString(),
    });
  });
}
