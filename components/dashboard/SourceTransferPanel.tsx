"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getRegionById } from "@global-pulse/shared";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useIssueOverlaps } from "@/lib/hooks/useIssueOverlaps";
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

function formatDetectedAt(value: string): string {
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

export function SourceTransferPanel({ primaryScope, limit = 80 }: SourceTransferPanelProps) {
  const { data, isLoading, error } = useIssueOverlaps(limit, 2);
  const overlaps = useMemo(() => data?.overlaps ?? [], [data?.overlaps]);

  const forwardLeader = primaryScope;
  const reverseLeader = primaryScope === "community" ? "news" : "community";
  const forwardLabel = primaryScope === "community" ? "커뮤니티→뉴스" : "뉴스→커뮤니티";
  const reverseLabel = primaryScope === "community" ? "뉴스 선행" : "커뮤니티 선행";
  const detailDirection = primaryScope === "community" ? "community_to_news" : "news_to_community";

  const forwardOverlaps = useMemo(
    () => overlaps.filter((item) => item.leader === forwardLeader),
    [forwardLeader, overlaps],
  );
  const reverseOverlaps = useMemo(
    () => overlaps.filter((item) => item.leader === reverseLeader),
    [overlaps, reverseLeader],
  );
  const tieCount = useMemo(
    () => overlaps.filter((item) => item.leader === "tie").length,
    [overlaps],
  );
  const latestForward = forwardOverlaps[0];

  return (
    <section className="card-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title">소스 전이 요약</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            상세 전이 분석은 전용 탭에서 확인할 수 있습니다.
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
            <p className="text-[11px] text-[var(--text-tertiary)]">{forwardLabel}</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{forwardOverlaps.length.toLocaleString()}</p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] text-[var(--text-tertiary)]">{reverseLabel}</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{reverseOverlaps.length.toLocaleString()}</p>
          </article>
          <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[11px] text-[var(--text-tertiary)]">동시 감지(tie)</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{tieCount.toLocaleString()}</p>
          </article>
        </div>
      ) : null}

      {!isLoading && !error && latestForward ? (
        <div className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
          <p>
            최근 {forwardLabel} 감지:{" "}
            {getRegionById(latestForward.regionId)?.flagEmoji ?? "🌐"} {latestForward.regionId.toUpperCase()} ·{" "}
            {formatDetectedAt(latestForward.detectedAt)} · 지연 {formatLagMinutes(latestForward.lagMinutes)}
          </p>
          <p className="mt-1 text-[var(--text-primary)]">
            {getDisplayTopicName({
              id: latestForward.communityTopic.id,
              nameKo: latestForward.communityTopic.nameKo,
              nameEn: latestForward.communityTopic.nameEn,
              summaryKo: undefined,
              summaryEn: undefined,
            })}
            {" ↔ "}
            {getDisplayTopicName({
              id: latestForward.newsTopic.id,
              nameKo: latestForward.newsTopic.nameKo,
              nameEn: latestForward.newsTopic.nameEn,
              summaryKo: undefined,
              summaryEn: undefined,
            })}
          </p>
        </div>
      ) : null}
    </section>
  );
}
