"use client";

import { useMemo } from "react";
import { getRegionById, type GlobalTopic } from "@global-pulse/shared";
import { aggregateFlowEdges } from "@/lib/utils/propagation-flow";
import { formatLagKorean, formatTimeOfDay } from "@/lib/utils/topic-narrative";
import { prepareQualifiedGlobalTopics } from "@/lib/utils/signal-quality";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

interface PropagationEventListProps {
  topics: GlobalTopic[];
  scope: "community" | "news";
  onTopicSelect?: (topicId: number) => void;
}

interface PropagationEventRow {
  key: string;
  from: string;
  to: string;
  lagMinutes: number;
  confidence: number;
  eventAt: string | null;
  topicId: number | null;
  topicName: string;
}

function toFinite(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function findMatchedTopic(topics: GlobalTopic[], from: string, to: string, lagMinutes: number): GlobalTopic | null {
  const candidates = topics
    .filter((topic) =>
      (topic.propagationEdges ?? []).some((edge) => {
        if (!edge) return false;
        if (edge.from !== from || edge.to !== to) return false;
        return Math.abs(toFinite(edge.lagMinutes) - lagMinutes) <= 120;
      }),
    )
    .sort((left, right) => {
      const leftScore = toFinite(left.totalHeatScore) * Math.max(0.05, toFinite(left.spreadScore));
      const rightScore = toFinite(right.totalHeatScore) * Math.max(0.05, toFinite(right.spreadScore));
      return rightScore - leftScore;
    });

  return candidates[0] ?? null;
}

function toEventRows(topics: GlobalTopic[], scope: "community" | "news"): PropagationEventRow[] {
  const qualifiedTopics = prepareQualifiedGlobalTopics(topics, scope);
  const edges = aggregateFlowEdges(qualifiedTopics, {
    limit: scope === "community" ? 48 : 24,
    maxTopics: scope === "community" ? 128 : 64,
  });

  const rows = edges.map((edge, index) => {
    const matchedTopic = findMatchedTopic(qualifiedTopics, edge.from, edge.to, edge.lagMinutes);
    const firstSeenAtMs = matchedTopic?.firstSeenAt ? new Date(matchedTopic.firstSeenAt).getTime() : Number.NaN;
    const eventAtMs = Number.isFinite(firstSeenAtMs) ? firstSeenAtMs + edge.lagMinutes * 60_000 : Number.NaN;
    const eventAtIso = Number.isFinite(eventAtMs) ? new Date(eventAtMs).toISOString() : null;

    return {
      key: `${edge.from}-${edge.to}-${index}`,
      from: edge.from,
      to: edge.to,
      lagMinutes: edge.lagMinutes,
      confidence: edge.confidence,
      eventAt: eventAtIso,
      topicId: typeof matchedTopic?.id === "number" ? matchedTopic.id : null,
      topicName: matchedTopic
        ? getDisplayTopicName({
            id: matchedTopic.id,
            nameKo: matchedTopic.nameKo,
            nameEn: matchedTopic.nameEn,
            summaryKo: matchedTopic.summaryKo,
            summaryEn: matchedTopic.summaryEn,
          })
        : "관련 토픽 확인 중",
    };
  });

  return rows
    .sort((left, right) => {
      const leftTs = left.eventAt ? new Date(left.eventAt).getTime() : Number.NEGATIVE_INFINITY;
      const rightTs = right.eventAt ? new Date(right.eventAt).getTime() : Number.NEGATIVE_INFINITY;
      if (rightTs !== leftTs) {
        return rightTs - leftTs;
      }
      return right.confidence - left.confidence;
    })
    .slice(0, scope === "community" ? 12 : 8);
}

export function PropagationEventList({ topics, scope, onTopicSelect }: PropagationEventListProps) {
  const rows = useMemo(() => toEventRows(topics, scope), [topics, scope]);

  return (
    <section className="card-panel h-full p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">확산 이벤트</h3>
        <span className="text-[11px] text-[var(--text-secondary)]">최근 24h</span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
          현재 배치에서 확인된 확산 이벤트가 없습니다.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => {
            const fromRegion = getRegionById(row.from);
            const toRegion = getRegionById(row.to);
            const canOpen = Boolean(onTopicSelect && row.topicId !== null);

            return (
              <li key={row.key}>
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (canOpen && row.topicId !== null) {
                      onTopicSelect?.(row.topicId);
                    }
                  }}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-2.5 text-left transition hover:border-[var(--border-hover)] disabled:cursor-default disabled:opacity-95"
                >
                  <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                    {formatTimeOfDay(row.eventAt)}
                    {"  "}
                    {fromRegion ? `${fromRegion.flagEmoji} ${row.from.toUpperCase()}` : row.from.toUpperCase()}
                    {" -> "}
                    {toRegion ? `${toRegion.flagEmoji} ${row.to.toUpperCase()}` : row.to.toUpperCase()}
                    {"  "}
                    {formatLagKorean(row.lagMinutes)}
                  </p>
                  <p className="mt-1 line-clamp-2 break-words text-xs text-[var(--text-primary)]">{row.topicName}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">신뢰도 {Math.round(row.confidence * 100)}%</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
