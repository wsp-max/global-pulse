import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";

interface SourceHealthRow {
  id: string;
  region_id: string;
  name: string;
  last_error: string | null;
  last_scraped_at: string | null;
  recent_count: number | string | null;
}

interface ErrorGroup {
  errorCode: string;
  count: number;
  sources: Array<{
    id: string;
    name: string;
    regionId: string;
  }>;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function toErrorCode(error: string | null): string {
  if (!error) {
    return "none";
  }
  const normalized = error.trim();
  if (!normalized) {
    return "unknown";
  }
  const token = normalized.split(/[\s:|]+/, 1)[0] ?? "unknown";
  return token.toLowerCase().slice(0, 40);
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/sources/health", async () => {
    const postgres = getPostgresPoolOrNull();

    if (!postgres) {
      return NextResponse.json({
        healthySources: 0,
        totalSources: 0,
        degradedSources: 0,
        degradedByCode: [],
        configured: false,
        provider: "none",
        lastUpdated: new Date().toISOString(),
      });
    }

    const { rows } = await postgres.query<SourceHealthRow>(
      `
      with recent as (
        select source_id, count(*) as recent_count
        from raw_posts
        where collected_at >= now() - interval '24 hours'
        group by source_id
      )
      select
        s.id,
        s.region_id,
        s.name,
        s.last_error,
        s.last_scraped_at,
        coalesce(recent.recent_count, 0) as recent_count
      from sources s
      left join recent on recent.source_id = s.id
      order by s.region_id asc, s.id asc
      `,
    );

    const healthyRows = rows.filter((row) => toNumber(row.recent_count) >= 1 && !row.last_error);
    const degradedRows = rows.filter((row) => !healthyRows.includes(row));

    const groups = new Map<string, ErrorGroup>();
    for (const row of degradedRows) {
      const errorCode = toNumber(row.recent_count) < 1 ? "no_data_24h" : toErrorCode(row.last_error);
      const existing = groups.get(errorCode);
      if (!existing) {
        groups.set(errorCode, {
          errorCode,
          count: 1,
          sources: [{ id: row.id, name: row.name, regionId: row.region_id }],
        });
        continue;
      }
      existing.count += 1;
      if (existing.sources.length < 8) {
        existing.sources.push({ id: row.id, name: row.name, regionId: row.region_id });
      }
    }

    return NextResponse.json({
      healthySources: healthyRows.length,
      totalSources: rows.length,
      degradedSources: degradedRows.length,
      degradedByCode: [...groups.values()].sort((left, right) => right.count - left.count),
      configured: true,
      provider: "postgres",
      lastUpdated: new Date().toISOString(),
    });
  });
}
