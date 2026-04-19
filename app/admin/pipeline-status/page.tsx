import { REGIONS } from "@global-pulse/shared";
import type { Pool } from "pg";
import { getPostgresPoolOrNull } from "@/app/api/_shared/postgres-server";

interface AnalyzerBatchRow {
  finished_at: string;
  scope: "community" | "news" | "mixed";
  topics_count: number | string;
  enriched_count: number | string;
}

interface RegionSummaryRow {
  region_id: string;
  scope: "community" | "news" | "mixed" | null;
  snapshot_at: string | null;
  active_topics: number | string | null;
  active_sources: number | string | null;
  total_sources: number | string | null;
}

interface PipelineStatusData {
  batches: Array<{
    finishedAt: string;
    scope: "community" | "news" | "mixed";
    topicsCount: number;
    enrichedCount: number;
    useGeminiEstimated: boolean;
    requestCountEstimated: number;
    fallbackCountEstimated: number;
  }>;
  regionSummary: Array<{
    regionId: string;
    regionName: string;
    scope: "community" | "news" | "mixed";
    snapshotAt: string | null;
    activeTopics: number;
    activeSources: number;
    totalSources: number;
  }>;
  overlap24h: number;
  avgPropagationEdges24h: number;
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

async function fetchPipelineStatus(pool: Pool): Promise<PipelineStatusData> {
  const [batchResult, regionResult, overlapResult, edgesResult] = await Promise.all([
    pool.query<AnalyzerBatchRow>(
      `
      with runs as (
        select
          max(created_at) as finished_at,
          coalesce(scope, 'community')::text as scope,
          count(*) as topics_count,
          count(*) filter (where summary_ko is not null and summary_en is not null) as enriched_count
        from topics
        where created_at >= now() - interval '48 hours'
        group by date_trunc('minute', created_at), coalesce(scope, 'community')
      )
      select finished_at, scope::text, topics_count, enriched_count
      from runs
      order by finished_at desc
      limit 10
      `,
    ),
    pool.query<RegionSummaryRow>(
      `
      with latest_snapshot as (
        select distinct on (region_id, coalesce(scope, 'community'))
          region_id,
          coalesce(scope, 'community')::text as scope,
          snapshot_at,
          active_topics
        from region_snapshots
        order by region_id, coalesce(scope, 'community'), snapshot_at desc
      ),
      source_counts as (
        select
          region_id,
          count(*) filter (where is_active = true) as active_sources,
          count(*) as total_sources
        from sources
        group by region_id
      )
      select
        r.id as region_id,
        ls.scope::text,
        ls.snapshot_at,
        ls.active_topics,
        coalesce(sc.active_sources, 0) as active_sources,
        coalesce(sc.total_sources, 0) as total_sources
      from regions r
      left join latest_snapshot ls
        on ls.region_id = r.id
       and ls.scope = 'community'
      left join source_counts sc on sc.region_id = r.id
      order by r.sort_order asc, r.id asc
      `,
    ),
    pool.query<{ count: number | string }>(
      `
      select count(*) as count
      from issue_overlaps
      where detected_at >= now() - interval '24 hours'
      `,
    ),
    pool.query<{ avg_edges: number | string | null }>(
      `
      select
        avg(jsonb_array_length(coalesce(propagation_edges, '[]'::jsonb))) as avg_edges
      from global_topics
      where created_at >= now() - interval '24 hours'
      `,
    ),
  ]);

  const regionNameById = new Map<string, string>(REGIONS.map((region) => [region.id, region.nameEn]));

  const batches = batchResult.rows.map((row) => {
    const topicsCount = toNumber(row.topics_count);
    const enrichedCount = toNumber(row.enriched_count);
    const useGeminiEstimated = enrichedCount > 0;
    const requestCountEstimated = useGeminiEstimated ? Math.max(1, Math.ceil(topicsCount / 12)) : 0;
    const fallbackCountEstimated = useGeminiEstimated
      ? Math.max(0, Math.ceil(Math.max(0, topicsCount - enrichedCount) / 12))
      : 0;

    return {
      finishedAt: row.finished_at,
      scope: row.scope,
      topicsCount,
      enrichedCount,
      useGeminiEstimated,
      requestCountEstimated,
      fallbackCountEstimated,
    };
  });

  const regionSummary = regionResult.rows.map((row) => ({
    regionId: row.region_id,
    regionName: regionNameById.get(row.region_id) ?? row.region_id.toUpperCase(),
    scope: (row.scope ?? "community") as "community" | "news" | "mixed",
    snapshotAt: row.snapshot_at,
    activeTopics: toNumber(row.active_topics),
    activeSources: toNumber(row.active_sources),
    totalSources: toNumber(row.total_sources),
  }));

  return {
    batches,
    regionSummary,
    overlap24h: toNumber(overlapResult.rows[0]?.count),
    avgPropagationEdges24h: Number(toNumber(edgesResult.rows[0]?.avg_edges).toFixed(2)),
  };
}

export default async function PipelineStatusPage() {
  const pool = getPostgresPoolOrNull();
  if (!pool) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display text-2xl text-[var(--text-accent)]">Pipeline Status</h1>
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          PostgreSQL 설정이 없어 파이프라인 상태를 조회할 수 없습니다.
        </p>
      </main>
    );
  }

  const data = await fetchPipelineStatus(pool);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-[var(--text-accent)]">Pipeline Status</h1>
        <p className="text-xs text-[var(--text-tertiary)]">/pulse/admin/pipeline-status</p>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Issue Overlaps (24h)</p>
          <p className="mt-1 font-mono text-xl">{data.overlap24h}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Avg Propagation Edges (24h)</p>
          <p className="mt-1 font-mono text-xl">{data.avgPropagationEdges24h}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Recent Analyzer Buckets</p>
          <p className="mt-1 font-mono text-xl">{data.batches.length}</p>
        </article>
      </section>

      <section className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Analyzer Batch (최근 10)</h2>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          request/fallback은 저장 로그 부재로 추정치(estimated)입니다.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-tertiary)]">
                <th className="px-2 py-2">Finished At</th>
                <th className="px-2 py-2">Scope</th>
                <th className="px-2 py-2">Topics</th>
                <th className="px-2 py-2">Enriched</th>
                <th className="px-2 py-2">Use Gemini</th>
                <th className="px-2 py-2">Req (est)</th>
                <th className="px-2 py-2">Fallback (est)</th>
              </tr>
            </thead>
            <tbody>
              {data.batches.map((row) => (
                <tr key={`${row.scope}-${row.finishedAt}`} className="border-b border-[var(--border-default)]/60">
                  <td className="px-2 py-2 font-mono text-[11px]">{row.finishedAt}</td>
                  <td className="px-2 py-2">{row.scope}</td>
                  <td className="px-2 py-2 font-mono">{row.topicsCount}</td>
                  <td className="px-2 py-2 font-mono">{row.enrichedCount}</td>
                  <td className="px-2 py-2">{row.useGeminiEstimated ? "yes" : "no"}</td>
                  <td className="px-2 py-2 font-mono">{row.requestCountEstimated}</td>
                  <td className="px-2 py-2 font-mono">{row.fallbackCountEstimated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Region Snapshot / Source Health</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-tertiary)]">
                <th className="px-2 py-2">Region</th>
                <th className="px-2 py-2">Scope</th>
                <th className="px-2 py-2">Latest Snapshot</th>
                <th className="px-2 py-2">Active Topics</th>
                <th className="px-2 py-2">Sources (active/total)</th>
              </tr>
            </thead>
            <tbody>
              {data.regionSummary.map((row) => (
                <tr key={`${row.regionId}-${row.scope}`} className="border-b border-[var(--border-default)]/60">
                  <td className="px-2 py-2">{row.regionName}</td>
                  <td className="px-2 py-2">{row.scope}</td>
                  <td className="px-2 py-2 font-mono text-[11px]">{row.snapshotAt ?? "-"}</td>
                  <td className="px-2 py-2 font-mono">{row.activeTopics}</td>
                  <td className="px-2 py-2 font-mono">
                    {row.activeSources}/{row.totalSources}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
