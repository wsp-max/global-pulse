"use client";

import { useMemo } from "react";
import { getRegionById } from "@global-pulse/shared";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useIssueOverlaps } from "@/lib/hooks/useIssueOverlaps";
import type { IssueOverlapRow } from "@/lib/types/api";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

interface SourceTransferPanelProps {
  primaryScope: "community" | "news";
  onTopicSelect?: (topicId: number) => void;
  limit?: number;
}

function formatLagMinutes(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const safe = Math.abs(Number(value));
  if (safe < 60) {
    return `${Math.max(1, Math.round(safe))}분`;
  }
  const hours = safe / 60;
  if (hours < 10) {
    return `${hours.toFixed(1)}시간`;
  }
  return `${Math.round(hours)}시간`;
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

function toTopicName(topic: { id: number; nameKo: string; nameEn: string }): string {
  return getDisplayTopicName({
    id: topic.id,
    nameKo: topic.nameKo,
    nameEn: topic.nameEn,
    summaryKo: undefined,
    summaryEn: undefined,
  });
}

function compareByLagAsc(left: IssueOverlapRow, right: IssueOverlapRow): number {
  const leftLag = Number.isFinite(left.lagMinutes ?? Number.NaN) ? Math.abs(left.lagMinutes ?? 0) : Number.POSITIVE_INFINITY;
  const rightLag = Number.isFinite(right.lagMinutes ?? Number.NaN) ? Math.abs(right.lagMinutes ?? 0) : Number.POSITIVE_INFINITY;
  if (leftLag !== rightLag) {
    return leftLag - rightLag;
  }
  return new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime();
}

export function SourceTransferPanel({ primaryScope, onTopicSelect, limit = 80 }: SourceTransferPanelProps) {
  const { data, isLoading, error } = useIssueOverlaps(limit, 2);
  const overlaps = useMemo(() => data?.overlaps ?? [], [data?.overlaps]);

  const leadingScope = primaryScope;
  const reverseScope = primaryScope === "community" ? "news" : "community";
  const forwardLabel = primaryScope === "community" ? "커뮤니티 → 뉴스" : "뉴스 → 커뮤니티";
  const reverseLabel = primaryScope === "community" ? "뉴스 선행" : "커뮤니티 선행";

  const forwardOverlaps = useMemo(
    () => overlaps.filter((item) => item.leader === leadingScope).sort(compareByLagAsc),
    [leadingScope, overlaps],
  );
  const reverseOverlaps = useMemo(
    () => overlaps.filter((item) => item.leader === reverseScope),
    [overlaps, reverseScope],
  );
  const tieOverlaps = useMemo(() => overlaps.filter((item) => item.leader === "tie"), [overlaps]);

  return (
    <section className="card-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="section-title">소스 전이 감지</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {forwardLabel} 흐름의 선행 토픽과 지연시간(community/news first-post 기준)을 표시합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
          <span className="rounded-full border border-[var(--border-default)] px-2 py-1">
            {forwardLabel} {forwardOverlaps.length}건
          </span>
          <span className="rounded-full border border-[var(--border-default)] px-2 py-1">
            {reverseLabel} {reverseOverlaps.length}건
          </span>
          <span className="rounded-full border border-[var(--border-default)] px-2 py-1">
            동시 감지 {tieOverlaps.length}건
          </span>
        </div>
      </div>

      {isLoading ? <LoadingSkeleton className="mt-3 h-24" /> : null}

      {!isLoading && error ? (
        <p className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
          전이 데이터를 불러오지 못했습니다.
        </p>
      ) : null}

      {!isLoading && !error && forwardOverlaps.length === 0 ? (
        <p className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
          현재 배치에서 {forwardLabel} 전이가 감지되지 않았습니다.
        </p>
      ) : null}

      {!isLoading && !error && forwardOverlaps.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {forwardOverlaps.slice(0, 12).map((item) => {
            const fromTopic = primaryScope === "community" ? item.communityTopic : item.newsTopic;
            const toTopic = primaryScope === "community" ? item.newsTopic : item.communityTopic;
            const fromName = toTopicName(fromTopic);
            const toName = toTopicName(toTopic);
            const region = getRegionById(item.regionId);
            const canOpen = Boolean(onTopicSelect && fromTopic.id > 0);

            return (
              <li key={`transfer-${item.id}`}>
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (canOpen) {
                      onTopicSelect?.(fromTopic.id);
                    }
                  }}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-left transition hover:border-[var(--border-hover)] disabled:cursor-default"
                >
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {region ? `${region.flagEmoji} ${item.regionId.toUpperCase()}` : item.regionId.toUpperCase()}
                    {" · "}
                    {formatDetectedAt(item.detectedAt)}
                    {" · "}
                    지연 {formatLagMinutes(item.lagMinutes)}
                  </p>
                  <p className="mt-1 line-clamp-1 break-words text-xs text-[var(--text-primary)]">
                    {fromName}
                    {" -> "}
                    {toName}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

