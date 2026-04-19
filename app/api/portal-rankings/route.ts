import { NextResponse } from "next/server";
import { withApiRequestLog } from "../_shared/route-logger";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/portal-rankings", () => getPortalRankings(request));
}

async function getPortalRankings(request: Request) {
  const { searchParams } = new URL(request.url);
  const regionId = (searchParams.get("regionId") ?? "kr").trim().toLowerCase();
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 20), 100));

  const postgres = getPostgresPoolOrNull();
  if (!postgres) {
    return NextResponse.json({
      regionId,
      limit,
      rankings: [],
      configured: false,
      lastUpdated: new Date().toISOString(),
    });
  }

  const { rows } = await postgres.query<{
    id: number;
    source_id: string;
    region_id: string;
    rank: number;
    headline: string;
    url: string | null;
    view_count: number | null;
    captured_at: string;
  }>(
    `
    select id, source_id, region_id, rank, headline, url, view_count, captured_at
    from portal_ranking_signals
    where region_id = $1
      and captured_at >= now() - interval '6 hours'
    order by captured_at desc, rank asc
    limit $2
    `,
    [regionId, limit],
  );

  return NextResponse.json({
    regionId,
    limit,
    rankings: rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      regionId: row.region_id,
      rank: row.rank,
      headline: row.headline,
      url: row.url,
      viewCount: row.view_count,
      capturedAt: row.captured_at,
    })),
    configured: true,
    lastUpdated: new Date().toISOString(),
  });
}
