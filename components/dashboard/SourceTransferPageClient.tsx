"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAllRegions, getRegionById } from "@global-pulse/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useSourceTransfer } from "@/lib/hooks/useSourceTransfer";
import type {
  SourceTransferApiResponse,
  SourceTransferDirection,
  SourceTransferPairRow,
} from "@/lib/types/api";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

interface SourceTransferPageClientProps {
  initialDirection: SourceTransferDirection;
  initialHours: number;
  initialRegion: string;
  initialLimit: number;
  initialOffset: number;
  initialData?: SourceTransferApiResponse;
}

function parseDirection(value: string | null | undefined, fallback: SourceTransferDirection): SourceTransferDirection {
  if (value === "news_to_community" || value === "both") {
    return value;
  }
  if (value === "community_to_news") {
    return value;
  }
  return fallback;
}

function parseHours(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.trunc(parsed), 168));
}

function parseLimit(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.trunc(parsed), 200));
}

function parseOffset(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function parseRegion(value: string | null | undefined, fallback: string): string {
  const raw = (value ?? fallback).trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "all") return "all";
  const regionIds = new Set(getAllRegions().map((region) => region.id));
  return regionIds.has(raw) ? raw : "all";
}

function formatLag(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return "-";
  }
  const safe = Math.abs(Number(value));
  if (safe < 60) {
    return `${Math.max(1, Math.round(safe))}분`;
  }
  return `${(safe / 60).toFixed(1)}시간`;
}

function formatRatio(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return "-";
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatDetectedAt(value: string | null | undefined): string {
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

function formatPostAt(value: string | null | undefined): string {
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

function formatCosine(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return "-";
  }
  return Number(value).toFixed(3);
}

function directionLabel(direction: SourceTransferDirection): string {
  if (direction === "news_to_community") {
    return "뉴스 → 커뮤니티";
  }
  if (direction === "both") {
    return "양방향";
  }
  return "커뮤니티 → 뉴스";
}

function toTopicLabel(pair: SourceTransferPairRow, scope: "community" | "news"): string {
  if (scope === "community") {
    return getDisplayTopicName({
      id: pair.communityTopicId,
      nameKo: pair.communityTopicNameKo,
      nameEn: pair.communityTopicNameEn,
      summaryKo: undefined,
      summaryEn: undefined,
    });
  }
  return getDisplayTopicName({
    id: pair.newsTopicId,
    nameKo: pair.newsTopicNameKo,
    nameEn: pair.newsTopicNameEn,
    summaryKo: undefined,
    summaryEn: undefined,
  });
}

function truncateLabel(value: string, max = 34): string {
  const normalized = value.trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

function buildNarrative(
  direction: SourceTransferDirection,
  hours: number,
  snapshotSummary: SourceTransferApiResponse["summary"] | undefined,
  historySummary: SourceTransferApiResponse["summary"] | undefined,
  topPair: SourceTransferPairRow | undefined,
): string {
  if (!snapshotSummary) {
    return "소스 전이 스냅샷 데이터를 불러오는 중입니다.";
  }
  if (snapshotSummary.totalEvents <= 0) {
    return `최신 배치 스냅샷에서 ${directionLabel(direction)} 전이가 감지되지 않았습니다. ${hours}h 이력에서는 ${historySummary?.totalEvents?.toLocaleString() ?? "0"}건이 관측되었습니다.`;
  }

  const region = topPair ? getRegionById(topPair.regionId)?.nameKo ?? topPair.regionId.toUpperCase() : "-";
  const fromName = topPair ? toTopicLabel(topPair, "community") : "-";
  const toName = topPair ? toTopicLabel(topPair, "news") : "-";
  const lag = topPair ? formatLag(topPair.latestLagMinutes ?? topPair.avgLagMinutes) : "-";

  return `최신 배치 스냅샷 기준 ${directionLabel(direction)} 전이 ${snapshotSummary.totalEvents.toLocaleString()}건, 고유 전이쌍 ${snapshotSummary.uniquePairs.toLocaleString()}건입니다. 대표 전이는 ${region} "${fromName}" → "${toName}"이며 실제 lag는 ${lag}입니다. 별도 ${hours}h 이력 집계는 ${historySummary?.totalEvents?.toLocaleString() ?? "0"}건입니다.`;
}

export function SourceTransferPageClient({
  initialDirection,
  initialHours,
  initialRegion,
  initialLimit,
  initialOffset,
  initialData,
}: SourceTransferPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const direction = parseDirection(searchParams.get("direction"), initialDirection);
  const hours = parseHours(searchParams.get("hours"), initialHours);
  const region = parseRegion(searchParams.get("region"), initialRegion);
  const limit = parseLimit(searchParams.get("limit"), initialLimit);
  const offset = parseOffset(searchParams.get("offset"), initialOffset);

  const { data, isLoading, error } = useSourceTransfer(
    {
      direction,
      hours,
      region,
      limit,
      offset,
    },
    {
      fallbackData: initialData,
    },
  );

  const applyQuery = (next: Partial<Record<"direction" | "hours" | "region" | "limit" | "offset", string>>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("direction", next.direction ?? direction);
    params.set("hours", next.hours ?? String(hours));
    params.set("region", next.region ?? region);
    params.set("limit", next.limit ?? String(limit));
    params.set("offset", next.offset ?? "0");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const trendData = useMemo(
    () =>
      (data?.trendHourly ?? []).map((item) => ({
        ...item,
        label: new Date(item.hour).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      })),
    [data?.trendHourly],
  );

  const sankeyData = useMemo(() => {
    const nodes = (data?.sankey.nodes ?? []).map((node) => ({
      ...node,
      name: node.label,
    }));
    const links = data?.sankey.links ?? [];
    return { nodes, links };
  }, [data?.sankey.links, data?.sankey.nodes]);

  const pairs = useMemo(() => data?.pairs ?? [], [data?.pairs]);
  const snapshotSummary = data?.snapshotSummary ?? data?.summary;
  const historySummary = data?.historySummary ?? data?.summary;
  const latestAnalyzerRunAt = data?.latestAnalyzerRunAt ?? null;
  const totalPairs = data?.meta.totalPairs ?? 0;
  const returnedPairs = data?.meta.returnedPairs ?? 0;
  const currentPage = Math.floor(offset / Math.max(1, limit)) + 1;
  const totalPages = Math.max(1, Math.ceil(totalPairs / Math.max(1, limit)));
  const canPrev = offset > 0;
  const canNext = offset + returnedPairs < totalPairs;

  const topTransferData = useMemo(() => {
    return [...pairs]
      .sort((left, right) => {
        const leftCosine = left.avgCosine ?? -1;
        const rightCosine = right.avgCosine ?? -1;
        if (leftCosine !== rightCosine) {
          return rightCosine - leftCosine;
        }
        const leftLag = Math.abs(left.latestLagMinutes ?? left.avgLagMinutes ?? Number.POSITIVE_INFINITY);
        const rightLag = Math.abs(right.latestLagMinutes ?? right.avgLagMinutes ?? Number.POSITIVE_INFINITY);
        return leftLag - rightLag;
      })
      .slice(0, 12)
      .map((row) => {
        const community = toTopicLabel(row, "community");
        const news = toTopicLabel(row, "news");
        const score = Math.max(0, Number(((row.avgCosine ?? 0) * 100).toFixed(1)));
        const regionName = getRegionById(row.regionId)?.nameKo ?? row.regionId.toUpperCase();
        return {
          pairKey: row.pairKey,
          label: `${community} → ${news}`,
          cosineScore: score,
          lagMinutes: row.latestLagMinutes ?? row.avgLagMinutes,
          regionName,
        };
      });
  }, [pairs]);

  return (
    <main className="page-shell">
      <section className="card-panel p-4">
        <h1 className="section-title">소스 전이</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          기준을 분리해 보여줍니다. 상단 KPI와 전이쌍은 최신 배치 스냅샷 기준, 시간대 추이는 {hours}h 이력 기준입니다.
        </p>
      </section>

      <section className="card-panel p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <label className="text-xs text-[var(--text-secondary)]">
            방향
            <select
              value={direction}
              onChange={(event) => applyQuery({ direction: event.target.value })}
              className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="community_to_news">커뮤니티 → 뉴스</option>
              <option value="news_to_community">뉴스 → 커뮤니티</option>
              <option value="both">양방향</option>
            </select>
          </label>
          <label className="text-xs text-[var(--text-secondary)]">
            시간 창
            <select
              value={hours}
              onChange={(event) => applyQuery({ hours: event.target.value })}
              className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-primary)]"
            >
              {[6, 12, 24, 48, 72, 168].map((item) => (
                <option key={item} value={item}>
                  최근 {item}h
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[var(--text-secondary)]">
            지역
            <select
              value={region}
              onChange={(event) => applyQuery({ region: event.target.value })}
              className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="all">전체 지역</option>
              {getAllRegions().map((item) => (
                <option key={item.id} value={item.id}>
                  {item.flagEmoji} {item.nameKo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[var(--text-secondary)]">
            목록 건수
            <select
              value={limit}
              onChange={(event) => applyQuery({ limit: event.target.value })}
              className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-primary)]"
            >
              {[20, 30, 50, 80, 120].map((item) => (
                <option key={item} value={item}>
                  {item}건
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {isLoading ? <LoadingSkeleton className="h-24" /> : null}
      {!isLoading && error ? (
        <section className="card-panel p-4 text-sm text-[var(--text-secondary)]">
          소스 전이 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </section>
      ) : null}

      <section className="card-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">최신 배치 스냅샷</h2>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
            snapshot
          </span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">events</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {snapshotSummary?.totalEvents.toLocaleString() ?? "-"}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">pairs</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {snapshotSummary?.uniquePairs.toLocaleString() ?? "-"}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">lead share</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {formatRatio(snapshotSummary?.forwardLeadShare)}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">median lag</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {formatLag(snapshotSummary?.medianLagMinutes)}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">p90 lag</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {formatLag(snapshotSummary?.p90LagMinutes)}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">latest run</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatDetectedAt(latestAnalyzerRunAt)}</p>
          </article>
        </div>
      </section>

      <section className="card-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">{hours}h 이력</h2>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
            history
          </span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">events</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {historySummary?.totalEvents.toLocaleString() ?? "-"}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">pairs</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {historySummary?.uniquePairs.toLocaleString() ?? "-"}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">lead share</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {formatRatio(historySummary?.forwardLeadShare)}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">median lag</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {formatLag(historySummary?.medianLagMinutes)}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">latest detect</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {formatDetectedAt(historySummary?.latestDetectedAt)}
            </p>
          </article>
        </div>
      </section>

      <section className="card-panel p-4">
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {buildNarrative(direction, hours, snapshotSummary, historySummary, pairs[0])}
        </p>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <article className="card-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">Top 전이 막대 차트</h2>
            <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
              snapshot
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">상위 전이쌍 유사도(값)와 실제 lag를 함께 확인합니다.</p>
          <div className="mt-3 h-[420px] w-full">
            {topTransferData.length === 0 ? (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-4 text-xs text-[var(--text-secondary)]">
                표시할 스냅샷 전이쌍이 없습니다.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTransferData} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${Math.round(value)}%`}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={260}
                    tickFormatter={(value) => truncateLabel(String(value))}
                    tick={{ fill: "#cbd5e1", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                    }}
                    formatter={(value, name) => {
                      if (name === "cosineScore") {
                        return [`${Number(value).toFixed(1)}%`, "유사도"];
                      }
                      return [value as string, name];
                    }}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | {
                            label: string;
                            regionName: string;
                            lagMinutes: number | null;
                          }
                        | undefined;
                      if (!row) {
                        return "";
                      }
                      return `${row.regionName} | ${row.label} | lag ${formatLag(row.lagMinutes)}`;
                    }}
                  />
                  <Bar dataKey="cosineScore" name="cosineScore" radius={[0, 6, 6, 0]}>
                    {topTransferData.map((entry, index) => (
                      <Cell
                        key={entry.pairKey}
                        fill={index % 2 === 0 ? "rgba(56, 189, 248, 0.8)" : "rgba(251, 146, 60, 0.8)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="card-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">보조 Sankey</h2>
            <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
              snapshot
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">상위 링크 8개만 축약해 전이 흐름 방향을 빠르게 확인합니다.</p>
          <div className="mt-3 h-[420px] w-full">
            {sankeyData.links.length === 0 ? (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-4 text-xs text-[var(--text-secondary)]">
                표시할 전이 흐름이 없습니다.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={sankeyData}
                  nodePadding={26}
                  nodeWidth={14}
                  linkCurvature={0.35}
                  margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                >
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                    }}
                  />
                </Sankey>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className="card-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">시간대 추이</h2>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
            {hours}h history
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">시간별 전이 이벤트 수와 평균 지연(24h 이력 분석)을 보여줍니다.</p>
        <div className="mt-3 h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" minTickGap={22} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis
                yAxisId="events"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#334155" }}
                tickLine={{ stroke: "#334155" }}
                width={38}
              />
              <YAxis
                yAxisId="lag"
                orientation="right"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#334155" }}
                tickLine={{ stroke: "#334155" }}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                }}
                formatter={(value, name) => {
                  const numeric = typeof value === "number" ? value : Number(value ?? 0);
                  if (name === "eventCount") return [numeric.toLocaleString(), "이벤트"];
                  if (name === "avgLagMinutes") return [formatLag(numeric), "평균 지연"];
                  return [numeric, String(name)];
                }}
              />
              <Bar yAxisId="events" dataKey="eventCount" name="eventCount" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="lag"
                type="monotone"
                dataKey="avgLagMinutes"
                name="avgLagMinutes"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">전이쌍 상세</h2>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => applyQuery({ offset: String(Math.max(0, offset - limit)) })}
              className="rounded-md border border-[var(--border-default)] px-2 py-1 disabled:opacity-40"
            >
              이전
            </button>
            <span>
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => applyQuery({ offset: String(offset + limit) })}
              className="rounded-md border border-[var(--border-default)] px-2 py-1 disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </div>

        {pairs.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
            조건에 맞는 전이쌍이 없습니다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-tertiary)]">
                  <th className="px-2 py-2">지역</th>
                  <th className="px-2 py-2">커뮤니티 토픽</th>
                  <th className="px-2 py-2">뉴스 토픽</th>
                  <th className="px-2 py-2">유사도</th>
                  <th className="px-2 py-2">실제 lag</th>
                  <th className="px-2 py-2">커뮤니티 최초 게시</th>
                  <th className="px-2 py-2">뉴스 최초 게시</th>
                  <th className="px-2 py-2">감지(보조)</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((row) => {
                  const regionInfo = getRegionById(row.regionId);
                  const communityName = toTopicLabel(row, "community");
                  const newsName = toTopicLabel(row, "news");
                  return (
                    <tr key={row.pairKey} className="border-b border-[var(--border-default)]/60">
                      <td className="px-2 py-2 text-[var(--text-primary)]">
                        {regionInfo ? `${regionInfo.flagEmoji} ${regionInfo.nameKo}` : row.regionId.toUpperCase()}
                      </td>
                      <td className="px-2 py-2">
                        {row.communityTopicId > 0 ? (
                          <Link href={`/topic/${row.communityTopicId}`} className="text-sky-300 hover:underline">
                            {communityName}
                          </Link>
                        ) : (
                          <span className="text-[var(--text-primary)]">{communityName}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {row.newsTopicId > 0 ? (
                          <Link href={`/topic/${row.newsTopicId}`} className="text-orange-300 hover:underline">
                            {newsName}
                          </Link>
                        ) : (
                          <span className="text-[var(--text-primary)]">{newsName}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-[var(--text-primary)]">{formatCosine(row.avgCosine)}</td>
                      <td className="px-2 py-2 text-[var(--text-primary)]">
                        {formatLag(row.latestLagMinutes ?? row.avgLagMinutes)}
                      </td>
                      <td className="px-2 py-2 text-[var(--text-primary)]">{formatPostAt(row.communityFirstPostAt)}</td>
                      <td className="px-2 py-2 text-[var(--text-primary)]">{formatPostAt(row.newsFirstPostAt)}</td>
                      <td className="px-2 py-2 text-[var(--text-secondary)]">
                        {formatDetectedAt(row.firstDetectedAt)} / {formatDetectedAt(row.lastDetectedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
