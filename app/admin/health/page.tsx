import Link from "next/link";
import { REGIONS } from "@global-pulse/shared";
import type { Pool } from "pg";
import { getPostgresPoolOrNull } from "@/app/api/_shared/postgres-server";
import {
  buildSourceErrorGroups,
  fetchSourceHealthRecords,
  summarizeRegionSourceHealth,
  summarizeSourceHealth,
  type SourceHealthRecord,
} from "@/lib/source-health";
import type { SourceHealthStatus } from "@/lib/types/api";

export const dynamic = "force-dynamic";

interface AdminHealthPageProps {
  searchParams: Promise<{ status?: string }>;
}

type StatusFilter = "all" | "healthy" | "stale" | "degraded" | "auto-disabled" | "optional-blocked";

interface AdminHealthPayload {
  summary: ReturnType<typeof summarizeSourceHealth>;
  degradedByCode: ReturnType<typeof buildSourceErrorGroups>;
  rows: SourceHealthRecord[];
  lowCoverageRegions: Array<{
    regionId: string;
    regionName: string;
    coveragePct: number;
    collected: number;
    active: number;
    disabled: number;
  }>;
}

function parseFilter(value: string | undefined): StatusFilter {
  if (value === "healthy" || value === "stale" || value === "degraded" || value === "auto-disabled" || value === "optional-blocked") {
    return value;
  }
  return "all";
}

function matchesFilter(row: SourceHealthRecord, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "healthy") return row.status === "healthy";
  if (filter === "stale") return row.status === "stale";
  if (filter === "degraded") return row.status === "degraded";
  if (filter === "auto-disabled") return row.status === "auto_disabled";
  return row.status === "optional_blocked";
}

function statusBadgeClass(status: SourceHealthStatus): string {
  switch (status) {
    case "healthy":
    case "optional_healthy":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "stale":
    case "optional_stale":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "degraded":
    case "optional_degraded":
      return "border-orange-500/40 bg-orange-500/10 text-orange-200";
    case "auto_disabled":
    case "disabled":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    case "optional_blocked":
      return "border-violet-500/40 bg-violet-500/10 text-violet-200";
    default:
      return "border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)]";
  }
}

function suggestedAction(row: SourceHealthRecord): string {
  if (row.status === "auto_disabled") {
    return "대체 source 검토 후 수동 재활성";
  }
  if (row.status === "disabled") {
    return "운영 정책 확인 후 복구 후보 등록";
  }
  if (row.status === "optional_blocked") {
    return "옵션 신호 blocked 유지, KPI 제외";
  }
  if (row.status === "degraded") {
    if (row.recentErrorCode === "http_429") {
      return "요청 간격 확대 및 백오프 적용";
    }
    if (row.recentErrorCode === "http_403") {
      return "엔드포인트/접근 정책 점검";
    }
    if (row.recentErrorCode === "no_items_parsed") {
      return "파서 셀렉터 점검";
    }
    return "최근 실패 원인 점검 및 재시도";
  }
  if (row.status === "stale") {
    return "최신 성공은 있으나 24h 데이터 없음";
  }
  return "-";
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function fetchHealth(pool: Pool): Promise<AdminHealthPayload> {
  const rows = await fetchSourceHealthRecords(pool);
  const summary = summarizeSourceHealth(rows);
  const degradedByCode = buildSourceErrorGroups(rows);
  const regionMeta = new Map<string, string>(REGIONS.map((region) => [region.id, region.nameKo]));
  const regionRows = new Map<string, SourceHealthRecord[]>();

  for (const row of rows) {
    const current = regionRows.get(row.regionId) ?? [];
    current.push(row);
    regionRows.set(row.regionId, current);
  }

  const lowCoverageRegions = [...regionRows.entries()]
    .map(([regionId, stats]) => {
      const summarized = summarizeRegionSourceHealth(regionId, stats, []);
      return {
        regionId,
        regionName: regionMeta.get(regionId) ?? regionId.toUpperCase(),
        coveragePct: summarized.collectionCoveragePct,
        collected: summarized.collectedSources24h,
        active: summarized.activeSources,
        disabled: summarized.disabledSources,
      };
    })
    .filter((row) => row.active > 0 && row.coveragePct < 50)
    .sort((left, right) => left.coveragePct - right.coveragePct || right.disabled - left.disabled)
    .slice(0, 12);

  return {
    summary,
    degradedByCode,
    rows,
    lowCoverageRegions,
  };
}

export default async function AdminHealthPage({ searchParams }: AdminHealthPageProps) {
  const { status: statusParam } = await searchParams;
  const filter = parseFilter(statusParam);
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
  const regionNameById = new Map<string, string>(REGIONS.map((region) => [region.id, region.nameEn]));
  const filteredRows = payload.rows.filter((row) => matchesFilter(row, filter));

  const filterItems: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: "all" },
    { id: "healthy", label: "healthy" },
    { id: "stale", label: "stale" },
    { id: "degraded", label: "degraded" },
    { id: "auto-disabled", label: "auto-disabled" },
    { id: "optional-blocked", label: "optional-blocked" },
  ];

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
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">최근 24시간 기준 source 상태</p>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Active regions</p>
          <p className="mt-1 font-mono text-xl">{REGIONS.length}/{REGIONS.length}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">수집 커버리지</p>
          <p className="mt-1 font-mono text-xl text-emerald-300">{payload.summary.collectionCoveragePct}%</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">복구 필요</p>
          <p className="mt-1 font-mono text-xl text-amber-300">{payload.summary.recoveryNeededSources}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Reddit optional blocked</p>
          <p className="mt-1 font-mono text-xl text-violet-300">{payload.summary.optionalBlockedSources}</p>
        </article>
      </section>

      {payload.lowCoverageRegions.length > 0 ? (
        <section className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <h2 className="text-sm font-semibold text-amber-100">최소 커버리지 미달 지역</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {payload.lowCoverageRegions.map((row) => (
              <span key={row.regionId} className="rounded-full border border-amber-500/40 px-2 py-1">
                {row.regionName} {row.collected}/{row.active} ({row.coveragePct}%)
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">상태 필터</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {filterItems.map((item) => {
            const active = filter === item.id;
            return (
              <Link
                key={item.id}
                href={item.id === "all" ? "/admin/health" : `/admin/health?status=${item.id}`}
                className={`rounded-full border px-2 py-1 ${
                  active
                    ? "border-[var(--text-accent)] bg-[var(--text-accent)]/10 text-[var(--text-accent)]"
                    : "border-[var(--border-default)] text-[var(--text-secondary)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
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
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Source details</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-tertiary)]">
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Region</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Latest Run</th>
                <th className="px-2 py-2">Latest Success</th>
                <th className="px-2 py-2">Posts (24h)</th>
                <th className="px-2 py-2">Success %</th>
                <th className="px-2 py-2">Disabled Reason</th>
                <th className="px-2 py-2">Suggested Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-default)]/60">
                  <td className="px-2 py-2">{row.name} ({row.id})</td>
                  <td className="px-2 py-2">{regionNameById.get(row.regionId) ?? row.regionId.toUpperCase()}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono">{row.latestRunStatus ?? "-"}</td>
                  <td className="px-2 py-2 font-mono">{formatDate(row.latestSuccessAt)}</td>
                  <td className="px-2 py-2 font-mono">{row.recentCount24h}</td>
                  <td className="px-2 py-2 font-mono">{row.successRate24h}%</td>
                  <td className="px-2 py-2">
                    <span className="font-mono">{row.recentErrorCode ?? row.lastError ?? "-"}</span>
                  </td>
                  <td className="px-2 py-2">{suggestedAction(row)}</td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-[var(--text-secondary)]" colSpan={9}>
                    선택한 필터에 해당하는 source가 없습니다.
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
