"use client";

import Link from "next/link";
import { getRegionById } from "@global-pulse/shared";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useSourceTransfer } from "@/lib/hooks/useSourceTransfer";
import type { SourceTransferDirection, SourceTransferPairRow } from "@/lib/types/api";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

interface SourceTransferPanelProps {
  primaryScope: "community" | "news";
  limit?: number;
}

function formatLagMinutes(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return "-";
  }
  const safe = Math.abs(Number(value));
  if (safe < 60) {
    return `${Math.max(1, Math.round(safe))}분`;
  }
  return `${(safe / 60).toFixed(1)}시간`;
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

function formatRatio(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return "-";
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function topicLabel(pair: SourceTransferPairRow, scope: "community" | "news"): string {
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

export function SourceTransferPanel({ primaryScope, limit = 20 }: SourceTransferPanelProps) {
  const detailDirection: SourceTransferDirection =
    primaryScope === "community" ? "community_to_news" : "news_to_community";
  const directionLabel = primaryScope === "community" ? "커뮤니티 -> 뉴스" : "뉴스 -> 커뮤니티";
  const sourceLeadLabel = primaryScope === "community" ? "커뮤니티 선행" : "뉴스 선행";
  const { data, isLoading, error } = useSourceTransfer({
    direction: detailDirection,
    hours: 24,
    region: "all",
    limit,
    offset: 0,
  });

  const summary = data?.snapshotSummary ?? data?.summary;
  const latestPair = data?.pairs[0];
  const candidateCount = data?.candidateSummary?.totalCandidates ?? 0;
  const latestCandidate = summary?.totalEvents === 0 ? data?.candidatePairs?.[0] : undefined;
  const latestRegion = latestPair ? getRegionById(latestPair.regionId) : null;
  const fromName = latestPair ? topicLabel(latestPair, primaryScope) : null;
  const toName = latestPair ? topicLabel(latestPair, primaryScope === "community" ? "news" : "community") : null;
  const candidateRegion = latestCandidate ? getRegionById(latestCandidate.regionId) : null;
  const candidateFromName = latestCandidate ? topicLabel(latestCandidate, primaryScope) : null;
  const candidateToName = latestCandidate
    ? topicLabel(latestCandidate, primaryScope === "community" ? "news" : "community")
    : null;

  return (
    <section className="card-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title">소스 전이 요약</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            최신 배치 스냅샷 기준으로 {directionLabel} 전이를 요약합니다.
          </p>
        </div>
        <Link
          href={`/source-transfer?direction=${detailDirection}&hours=24&region=all`}
          className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
        >
          상세 전이 분석
        </Link>
      </div>

      {isLoading ? <LoadingSkeleton className="mt-3 h-20" /> : null}

      {!isLoading && error ? (
        <p className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
          전이 데이터를 불러오지 못했습니다.
        </p>
      ) : null}

      {!isLoading && !error ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] text-[var(--text-tertiary)]">{sourceLeadLabel}</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {summary?.forwardLeadCount.toLocaleString() ?? "0"}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] text-[var(--text-tertiary)]">고유 전이쌍</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {summary?.uniquePairs.toLocaleString() ?? "0"}
            </p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] text-[var(--text-tertiary)]">선행 비율</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {formatRatio(summary?.forwardLeadShare)}
            </p>
          </article>
        </div>
      ) : null}

      {!isLoading && !error && summary?.totalEvents === 0 && candidateCount > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/5 p-3 text-xs text-[var(--text-secondary)]">
          <p className="text-amber-100">검토 후보 {candidateCount.toLocaleString()}건</p>
          <p className="mt-1">정식 전이 수에는 포함하지 않은 낮은 신뢰 후보입니다.</p>
        </div>
      ) : null}

      {!isLoading && !error && latestPair ? (
        <div className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
          <p>
            최근 대표 전이: {latestRegion?.flagEmoji ?? ""} {latestPair.regionId.toUpperCase()} ·{" "}
            {formatDetectedAt(latestPair.lastDetectedAt)} · lag{" "}
            {formatLagMinutes(latestPair.latestLagMinutes ?? latestPair.avgLagMinutes)}
          </p>
          <p className="mt-1 break-words text-[var(--text-primary)]">
            {fromName} {"->"} {toName}
          </p>
        </div>
      ) : null}

      {!isLoading && !error && !latestPair && latestCandidate ? (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/5 p-3 text-xs text-[var(--text-secondary)]">
          <p>
            검토 후보: {candidateRegion?.flagEmoji ?? ""} {latestCandidate.regionId.toUpperCase()} · 후보 점수{" "}
            {Math.round(latestCandidate.matchScore * 100)}% · lag{" "}
            {formatLagMinutes(latestCandidate.latestLagMinutes ?? latestCandidate.avgLagMinutes)}
          </p>
          <p className="mt-1 break-words text-[var(--text-primary)]">
            {candidateFromName} {"->"} {candidateToName}
          </p>
        </div>
      ) : null}
    </section>
  );
}
