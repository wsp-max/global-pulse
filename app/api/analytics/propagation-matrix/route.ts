import { NextResponse } from "next/server";
import { getAllRegions } from "@global-pulse/shared";
import type { DashboardScope } from "@/lib/types/api";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";

interface MatrixRow {
  from_region: string;
  to_region: string;
  edge_count: number | string;
  avg_lag_minutes: number | string | null;
  sample_topics: string[] | null;
}

function parseScope(value: string | null): DashboardScope {
  if (value === "news" || value === "mixed") {
    return value;
  }
  return "community";
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

function uniqueSampleTopics(input: string[] | null | undefined): string[] {
  if (!input || input.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of input) {
    const topic = (item ?? "").trim();
    if (!topic || seen.has(topic)) {
      continue;
    }
    seen.add(topic);
    output.push(topic);
    if (output.length >= 3) {
      break;
    }
  }
  return output;
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/analytics/propagation-matrix", async () => {
    const { searchParams } = new URL(request.url);
    const scope = parseScope(searchParams.get("scope"));
    const days = Math.min(Math.max(Number(searchParams.get("days") ?? 7), 1), 30);

    const allRegions = getAllRegions()
      .sort((left, right) => (left.sortOrder ?? 999) - (right.sortOrder ?? 999))
      .slice(0, 9)
      .map((region) => region.id);

    const postgres = getPostgresPoolOrNull();
    if (!postgres) {
      return NextResponse.json({
        scope,
        days,
        regions: allRegions,
        cells: [],
        insight: null,
        configured: false,
        provider: "none",
        lastUpdated: new Date().toISOString(),
      });
    }

    const { rows } = await postgres.query<MatrixRow>(
      `
      with recent as (
        select
          lower(edge->>'from') as from_region,
          lower(edge->>'to') as to_region,
          nullif(edge->>'lagMinutes', '')::float as lag_minutes,
          coalesce(gt.name_ko, gt.name_en) as topic_name
        from global_topics gt
        cross join lateral jsonb_array_elements(coalesce(gt.propagation_edges, '[]'::jsonb)) as edge
        where gt.created_at >= now() - ($1::text || ' days')::interval
          and gt.scope = $2
      )
      select
        from_region,
        to_region,
        count(*)::int as edge_count,
        avg(lag_minutes) as avg_lag_minutes,
        array_agg(topic_name order by lag_minutes asc nulls last) as sample_topics
      from recent
      where from_region = any($3::text[])
        and to_region = any($3::text[])
      group by from_region, to_region
      `,
      [days, scope, allRegions],
    );

    const cells = rows.map((row) => ({
      fromRegion: row.from_region,
      toRegion: row.to_region,
      edgeCount: toNumber(row.edge_count),
      avgLagMinutes: row.avg_lag_minutes === null ? null : toNumber(row.avg_lag_minutes),
      sampleTopics: uniqueSampleTopics(row.sample_topics),
    }));

    const groupedByFrom = new Map<string, number>();
    for (const cell of cells) {
      groupedByFrom.set(cell.fromRegion, (groupedByFrom.get(cell.fromRegion) ?? 0) + cell.edgeCount);
    }

    const strongest = [...cells].sort((left, right) => right.edgeCount - left.edgeCount)[0] ?? null;
    const insight = strongest
      ? {
          fromRegion: strongest.fromRegion,
          toRegion: strongest.toRegion,
          share:
            (strongest.edgeCount / Math.max(groupedByFrom.get(strongest.fromRegion) ?? strongest.edgeCount, 1)) * 100,
          avgLagHours:
            strongest.avgLagMinutes === null
              ? null
              : Number((strongest.avgLagMinutes / 60).toFixed(1)),
          text:
            `지난 ${days}일, ${strongest.fromRegion.toUpperCase()} 시작 토픽의 ` +
            `${Math.round(
              (strongest.edgeCount /
                Math.max(groupedByFrom.get(strongest.fromRegion) ?? strongest.edgeCount, 1)) *
                100,
            )}%가 평균 ${
              strongest.avgLagMinutes === null
                ? "-"
                : `${Math.max(0.1, strongest.avgLagMinutes / 60).toFixed(1)}h`
            } 내 ${strongest.toRegion.toUpperCase()}로 전파되었습니다.`,
        }
      : null;

    return NextResponse.json({
      scope,
      days,
      regions: allRegions,
      cells,
      insight,
      configured: true,
      provider: "postgres",
      lastUpdated: new Date().toISOString(),
    });
  });
}
