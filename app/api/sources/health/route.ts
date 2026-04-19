import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";

interface SourceHealthRow {
  id: string;
  region_id: string;
  name: string;
  is_active: boolean;
  last_error: string | null;
  last_scraped_at: string | null;
  recent_count: number | string | null;
  total_runs_24h: number | string | null;
  success_runs_24h: number | string | null;
  p95_latency_ms_24h: number | string | null;
  recent_error_code: string | null;
  recent_error_message: string | null;
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

interface SourceRunHealth {
  id: string;
  regionId: string;
  name: string;
  isActive: boolean;
  recentCount24h: number;
  totalRuns24h: number;
  successRuns24h: number;
  successRate24h: number;
  p95LatencyMs24h: number | null;
  lastScrapedAt: string | null;
  lastError: string | null;
  recentErrorCode: string | null;
  recentErrorMessage: string | null;
  isDegraded: boolean;
  isAutoDisabled: boolean;
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

function normalizeErrorCode(error: string | null): string {
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

function toRoundedPercent(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function isAutoDisabledMarker(lastError: string | null): boolean {
  return Boolean(lastError && lastError.startsWith("auto_disabled_consecutive_failures"));
}

function toSourceRunHealth(row: SourceHealthRow): SourceRunHealth {
  const totalRuns24h = toNumber(row.total_runs_24h);
  const successRuns24h = toNumber(row.success_runs_24h);
  const successRate24h = totalRuns24h > 0 ? toRoundedPercent((successRuns24h / totalRuns24h) * 100) : 0;
  const p95Raw = row.p95_latency_ms_24h === null ? null : toNumber(row.p95_latency_ms_24h);
  const p95LatencyMs24h = p95Raw === null || p95Raw <= 0 ? null : Math.round(p95Raw);
  const recentCount24h = toNumber(row.recent_count);
  const recentErrorCode = row.recent_error_code ?? (row.last_error ? normalizeErrorCode(row.last_error) : null);
  const recentErrorMessage = row.recent_error_message ?? row.last_error;
  const autoDisabled = isAutoDisabledMarker(row.last_error);
  const isDegraded = recentCount24h < 1 || !!recentErrorCode || (totalRuns24h > 0 && successRate24h < 70);

  return {
    id: row.id,
    regionId: row.region_id,
    name: row.name,
    isActive: row.is_active,
    recentCount24h,
    totalRuns24h,
    successRuns24h,
    successRate24h,
    p95LatencyMs24h,
    lastScrapedAt: row.last_scraped_at,
    lastError: row.last_error,
    recentErrorCode,
    recentErrorMessage,
    isDegraded,
    isAutoDisabled: autoDisabled,
  };
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
        autoDisabledSources24h: 0,
        degradedByCode: [],
        sourceStats: [],
        configured: false,
        provider: "none",
        lastUpdated: new Date().toISOString(),
      });
    }

    const { rows } = await postgres.query<SourceHealthRow>(
      `
      with recent_posts as (
        select source_id, count(*) as recent_count
        from raw_posts
        where collected_at >= now() - interval '24 hours'
        group by source_id
      ),
      run_stats as (
        select
          source_id,
          count(*) as total_runs_24h,
          count(*) filter (where status = 'success') as success_runs_24h,
          percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms_24h
        from collector_runs
        where started_at >= now() - interval '24 hours'
        group by source_id
      ),
      latest_failure as (
        select distinct on (source_id)
          source_id,
          error_code as recent_error_code,
          error_message as recent_error_message
        from collector_runs
        where started_at >= now() - interval '24 hours'
          and status <> 'success'
        order by source_id, finished_at desc
      )
      select
        s.id,
        s.region_id,
        s.name,
        s.is_active,
        s.last_error,
        s.last_scraped_at,
        coalesce(rp.recent_count, 0) as recent_count,
        coalesce(rs.total_runs_24h, 0) as total_runs_24h,
        coalesce(rs.success_runs_24h, 0) as success_runs_24h,
        rs.p95_latency_ms_24h,
        lf.recent_error_code,
        lf.recent_error_message
      from sources s
      left join recent_posts rp on rp.source_id = s.id
      left join run_stats rs on rs.source_id = s.id
      left join latest_failure lf on lf.source_id = s.id
      order by s.region_id asc, s.id asc
      `,
    );

    const stats = rows.map(toSourceRunHealth);
    const degradedRows = stats.filter((row) => row.isDegraded);
    const healthyRows = stats.filter((row) => !row.isDegraded);
    const autoDisabledSources24h = stats.filter((row) => row.isAutoDisabled).length;

    const groups = new Map<string, ErrorGroup>();
    for (const row of degradedRows) {
      const errorCode = row.recentCount24h < 1 ? "no_data_24h" : row.recentErrorCode ?? "unknown";
      const existing = groups.get(errorCode);
      if (!existing) {
        groups.set(errorCode, {
          errorCode,
          count: 1,
          sources: [{ id: row.id, name: row.name, regionId: row.regionId }],
        });
        continue;
      }
      existing.count += 1;
      if (existing.sources.length < 8) {
        existing.sources.push({ id: row.id, name: row.name, regionId: row.regionId });
      }
    }

    return NextResponse.json({
      healthySources: healthyRows.length,
      totalSources: rows.length,
      degradedSources: degradedRows.length,
      autoDisabledSources24h,
      degradedByCode: [...groups.values()].sort((left, right) => right.count - left.count),
      sourceStats: stats,
      configured: true,
      provider: "postgres",
      lastUpdated: new Date().toISOString(),
    });
  });
}

