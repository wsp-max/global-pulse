import { REGIONS } from "@global-pulse/shared";
import type { Pool } from "pg";
import { getPostgresPoolOrNull } from "@/app/api/_shared/postgres-server";

export const dynamic = "force-dynamic";

interface SourceHealthRow {
  id: string;
  region_id: string;
  name: string;
  type: "community" | "sns" | "news";
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

interface SourceHealthView {
  id: string;
  regionId: string;
  regionName: string;
  name: string;
  type: "community" | "sns" | "news";
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

interface AdminHealthPayload {
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    autoDisabled: number;
  };
  degradedByCode: Array<{
    errorCode: string;
    count: number;
  }>;
  degradedRows: SourceHealthView[];
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
  const token = error.trim().split(/[\s:|]+/, 1)[0] ?? "unknown";
  return token.toLowerCase().slice(0, 40);
}

function toPercent(successRuns: number, totalRuns: number): number {
  if (totalRuns <= 0) {
    return 0;
  }
  return Number(((successRuns / totalRuns) * 100).toFixed(1));
}

function isAutoDisabledMarker(error: string | null): boolean {
  return Boolean(error && error.startsWith("auto_disabled_consecutive_failures"));
}

async function fetchHealth(pool: Pool): Promise<AdminHealthPayload> {
  const regionNameById = new Map<string, string>(REGIONS.map((region) => [region.id, region.nameEn]));

  const { rows } = await pool.query<SourceHealthRow>(
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
      s.type,
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

  const views = rows.map<SourceHealthView>((row) => {
    const recentCount24h = toNumber(row.recent_count);
    const totalRuns24h = toNumber(row.total_runs_24h);
    const successRuns24h = toNumber(row.success_runs_24h);
    const successRate24h = toPercent(successRuns24h, totalRuns24h);
    const p95Value = row.p95_latency_ms_24h === null ? null : toNumber(row.p95_latency_ms_24h);
    const p95LatencyMs24h = p95Value === null || p95Value <= 0 ? null : Math.round(p95Value);
    const recentErrorCode = row.recent_error_code ?? (row.last_error ? normalizeErrorCode(row.last_error) : null);
    const recentErrorMessage = row.recent_error_message ?? row.last_error;
    const autoDisabled = isAutoDisabledMarker(row.last_error);
    const isDegraded = recentCount24h < 1 || !!recentErrorCode || (totalRuns24h > 0 && successRate24h < 70);

    return {
      id: row.id,
      regionId: row.region_id,
      regionName: regionNameById.get(row.region_id) ?? row.region_id.toUpperCase(),
      name: row.name,
      type: row.type,
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
  });

  const degradedRows = views.filter((row) => row.isDegraded);
  const grouped = new Map<string, number>();
  for (const row of degradedRows) {
    const code = row.recentCount24h < 1 ? "no_data_24h" : row.recentErrorCode ?? "unknown";
    grouped.set(code, (grouped.get(code) ?? 0) + 1);
  }

  return {
    summary: {
      total: views.length,
      healthy: views.length - degradedRows.length,
      degraded: degradedRows.length,
      autoDisabled: views.filter((row) => row.isAutoDisabled).length,
    },
    degradedByCode: [...grouped.entries()]
      .map(([errorCode, count]) => ({ errorCode, count }))
      .sort((left, right) => right.count - left.count),
    degradedRows,
  };
}

export default async function AdminHealthPage() {
  const pool = getPostgresPoolOrNull();

  if (!pool) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display text-2xl text-[var(--text-accent)]">Admin Health</h1>
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          PostgreSQL 설정이 없어 health 데이터를 조회할 수 없습니다.
        </p>
      </main>
    );
  }

  const payload = await fetchHealth(pool);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-[var(--text-accent)]">Admin Health</h1>
        <a
          href="/pulse/admin/tuning"
          className="rounded-md border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          Open Tuning
        </a>
      </div>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">/pulse/admin/health · 최근 24시간 수집 상태</p>

      <section className="mt-4 grid gap-3 sm:grid-cols-4">
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Total Sources</p>
          <p className="mt-1 font-mono text-xl">{payload.summary.total}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Healthy</p>
          <p className="mt-1 font-mono text-xl text-emerald-300">{payload.summary.healthy}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Degraded</p>
          <p className="mt-1 font-mono text-xl text-amber-300">{payload.summary.degraded}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Auto Disabled</p>
          <p className="mt-1 font-mono text-xl text-red-300">{payload.summary.autoDisabled}</p>
        </article>
      </section>

      <section className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Failures grouped by code</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {payload.degradedByCode.map((group) => (
            <span key={group.errorCode} className="rounded-full border border-[var(--border-default)] px-2 py-1">
              {group.errorCode}: {group.count}
            </span>
          ))}
          {payload.degradedByCode.length === 0 ? <span>No degraded sources.</span> : null}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Degraded sources</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-tertiary)]">
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Region</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Runs (24h)</th>
                <th className="px-2 py-2">Success %</th>
                <th className="px-2 py-2">P95 Latency</th>
                <th className="px-2 py-2">Posts (24h)</th>
                <th className="px-2 py-2">Recent Error</th>
                <th className="px-2 py-2">Last Scraped</th>
              </tr>
            </thead>
            <tbody>
              {payload.degradedRows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-default)]/60">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span>{row.name} ({row.id})</span>
                      {row.isAutoDisabled ? (
                        <span className="rounded-full border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300">
                          auto-disabled
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2">{row.regionName}</td>
                  <td className="px-2 py-2">{row.type}</td>
                  <td className="px-2 py-2 font-mono">{row.totalRuns24h}</td>
                  <td className="px-2 py-2 font-mono">{row.successRate24h}%</td>
                  <td className="px-2 py-2 font-mono">
                    {row.p95LatencyMs24h === null ? "-" : `${row.p95LatencyMs24h}ms`}
                  </td>
                  <td className="px-2 py-2 font-mono">{row.recentCount24h}</td>
                  <td className="px-2 py-2">
                    <span className="font-mono">{row.recentErrorCode ?? "-"}</span>
                    {row.recentErrorMessage ? (
                      <p className="mt-0.5 max-w-[320px] truncate text-[10px] text-[var(--text-tertiary)]">
                        {row.recentErrorMessage}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px]">{row.lastScrapedAt ?? "-"}</td>
                </tr>
              ))}
              {payload.degradedRows.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-[var(--text-secondary)]" colSpan={9}>
                    모든 소스가 healthy 상태입니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
