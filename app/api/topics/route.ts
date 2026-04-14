import { NextResponse } from "next/server";
import { getRegionById } from "@global-pulse/shared";
import { mapTopicRow, type TopicRow } from "../_shared/mappers";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";

const PERIOD_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "7d": 168,
};

function periodStartIso(period: string): string {
  const hours = PERIOD_HOURS[period] ?? 24;
  const start = new Date(Date.now() - hours * 60 * 60 * 1000);
  return start.toISOString();
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/topics", () => getTopics(request));
}

async function getTopics(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? "kr";
  const limit = Math.min(Number(searchParams.get("limit") ?? 15), 50);
  const offset = Number(searchParams.get("offset") ?? 0);
  const sort = searchParams.get("sort") ?? "heat";
  const period = searchParams.get("period") ?? "24h";
  const startIso = periodStartIso(period);
  const sortColumn =
    sort === "sentiment" ? "sentiment" : sort === "recent" ? "created_at" : "heat_score";

  const postgres = getPostgresPoolOrNull();
  if (postgres) {
    try {
      const [topicsResult, countResult, snapshotResult] = await Promise.all([
        postgres.query<TopicRow>(
          `
          with filtered as (
            select
              id,region_id,name_ko,name_en,summary_ko,summary_en,keywords,sentiment,heat_score,
              post_count,total_views,total_likes,total_comments,source_ids,rank,period_start,period_end,created_at
            from topics
            where region_id = $1 and period_end >= $2
          ),
          dedup as (
            select distinct on (lower(coalesce(name_en, name_ko)))
              *
            from filtered
            order by lower(coalesce(name_en, name_ko)), period_end desc, created_at desc, heat_score desc
          )
          select
            id,region_id,name_ko,name_en,summary_ko,summary_en,keywords,sentiment,heat_score,
            post_count,total_views,total_likes,total_comments,source_ids,rank,period_start,period_end
          from dedup
          order by ${sortColumn} desc, period_end desc
          offset $3
          limit $4
          `,
          [region, startIso, offset, limit],
        ),
        postgres.query<{ total: string | number }>(
          `
          with filtered as (
            select name_en, name_ko, period_end, created_at, heat_score
            from topics
            where region_id = $1 and period_end >= $2
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
          [region, startIso],
        ),
        postgres.query(
          `
          select *
          from region_snapshots
          where region_id = $1
          order by snapshot_at desc
          limit 1
          `,
          [region],
        ),
      ]);

      return NextResponse.json({
        topics: topicsResult.rows.map(mapTopicRow),
        total: Number(countResult.rows[0]?.total ?? 0),
        region: getRegionById(region),
        snapshot: snapshotResult.rows[0] ?? null,
        meta: { limit, offset, sort, period },
        configured: true,
        provider: "postgres",
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
    configured: false,
    provider: "none",
    lastUpdated: new Date().toISOString(),
  });
}


