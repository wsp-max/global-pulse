import { NextResponse } from "next/server";
import { getAllRegions } from "@global-pulse/shared";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";

export const dynamic = "force-dynamic";

interface HealthRow {
  region_id: string;
  snapshot_at: string;
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/regions/health", async () => {
    const pool = getPostgresPoolOrNull();
    const regions = getAllRegions();

    if (!pool) {
      return NextResponse.json({
        activeRegions: 0,
        totalRegions: regions.length,
        latestSnapshotAt: null,
        regions: [],
        configured: false,
        provider: "none",
        lastUpdated: new Date().toISOString(),
      });
    }

    const { rows } = await pool.query<HealthRow>(
      `
      with latest as (
        select distinct on (region_id)
          region_id,
          snapshot_at
        from region_snapshots
        where scope = 'community'
        order by region_id, snapshot_at desc
      )
      select region_id, snapshot_at
      from latest
      where snapshot_at >= now() - interval '1 hour'
      order by snapshot_at desc
      `,
    );

    return NextResponse.json({
      activeRegions: rows.length,
      totalRegions: regions.length,
      latestSnapshotAt: rows[0]?.snapshot_at ?? null,
      regions: rows,
      configured: true,
      provider: "postgres",
      lastUpdated: new Date().toISOString(),
    });
  });
}
