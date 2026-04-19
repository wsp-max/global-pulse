import { REGIONS } from "@global-pulse/shared";
import type { Pool } from "pg";
import { getPostgresPoolOrNull } from "@/app/api/_shared/postgres-server";

export const dynamic = "force-dynamic";

interface SourceHealthRow {
  id: string;
  region_id: string;
  name: string;
  type: "community" | "sns" | "news";
  last_error: string | null;
  last_scraped_at: string | null;
  recent_count: number | string | null;
}

interface HealthPayload {
  summary: {
    total: number;
    healthy: number;
    degraded: number;
  };
  degradedByCode: Array<{
    errorCode: string;
    count: number;
  }>;
  degradedRows: Array<{
    id: string;
    regionId: string;
    regionName: string;
    name: string;
    type: "community" | "sns" | "news";
    recentCount: number;
    lastScrapedAt: string | null;
    lastError: string | null;
    errorCode: string;
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

function toErrorCode(error: string | null, recentCount: number): string {
  if (recentCount < 1) {
    return "no_data_24h";
  }
  if (!error) {
    return "unknown";
  }
  const token = error.trim().split(/[\s:|]+/, 1)[0] ?? "unknown";
  return token.toLowerCase().slice(0, 40);
}

async function fetchHealth(pool: Pool): Promise<HealthPayload> {
  const regionNameById = new Map<string, string>(REGIONS.map((region) => [region.id, region.nameEn]));

  const { rows } = await pool.query<SourceHealthRow>(
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
      s.type,
      s.last_error,
      s.last_scraped_at,
      coalesce(recent.recent_count, 0) as recent_count
    from sources s
    left join recent on recent.source_id = s.id
    order by s.region_id asc, s.id asc
    `,
  );

  const degradedRows = rows
    .map((row) => {
      const recentCount = toNumber(row.recent_count);
      const errorCode = toErrorCode(row.last_error, recentCount);
      return {
        id: row.id,
        regionId: row.region_id,
        regionName: regionNameById.get(row.region_id) ?? row.region_id.toUpperCase(),
        name: row.name,
        type: row.type,
        recentCount,
        lastScrapedAt: row.last_scraped_at,
        lastError: row.last_error,
        errorCode,
      };
    })
    .filter((row) => row.recentCount < 1 || row.lastError);

  const grouped = new Map<string, number>();
  for (const row of degradedRows) {
    grouped.set(row.errorCode, (grouped.get(row.errorCode) ?? 0) + 1);
  }

  return {
    summary: {
      total: rows.length,
      healthy: rows.length - degradedRows.length,
      degraded: degradedRows.length,
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
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl text-[var(--text-accent)]">Admin Health</h1>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">/pulse/admin/health · 최근 24시간 소스 상태</p>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
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
      </section>

      <section className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Failures grouped by status code</h2>
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
                <th className="px-2 py-2">Count (24h)</th>
                <th className="px-2 py-2">Error Code</th>
                <th className="px-2 py-2">Last Error</th>
                <th className="px-2 py-2">Last Scraped</th>
              </tr>
            </thead>
            <tbody>
              {payload.degradedRows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-default)]/60">
                  <td className="px-2 py-2">{row.name} ({row.id})</td>
                  <td className="px-2 py-2">{row.regionName}</td>
                  <td className="px-2 py-2">{row.type}</td>
                  <td className="px-2 py-2 font-mono">{row.recentCount}</td>
                  <td className="px-2 py-2 font-mono">{row.errorCode}</td>
                  <td className="px-2 py-2">{row.lastError ?? "-"}</td>
                  <td className="px-2 py-2 font-mono text-[11px]">{row.lastScrapedAt ?? "-"}</td>
                </tr>
              ))}
              {payload.degradedRows.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-[var(--text-secondary)]" colSpan={7}>
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
