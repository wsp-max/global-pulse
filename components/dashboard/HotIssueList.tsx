"use client";

import Link from "next/link";
import { getRegionById, type GlobalTopic } from "@global-pulse/shared";

interface HotIssueListProps {
  topics: GlobalTopic[];
  onTopicSelect?: (topicId: number) => void;
}

function firstSentence(summary: string | null | undefined): string | null {
  if (!summary) {
    return null;
  }

  const trimmed = summary.trim();
  if (
    trimmed.startsWith("요약 준비 중") ||
    trimmed.startsWith("Summary pending") ||
    trimmed.startsWith("Signals for") ||
    trimmed.startsWith("핵심 키워드")
  ) {
    return null;
  }

  const first = trimmed
    .split(/[.!?。！？]\s|$/u)
    .map((item) => item.trim())
    .filter(Boolean)[0];

  if (!first) {
    return null;
  }

  if (first.length <= 80) {
    return first;
  }

  return `${first.slice(0, 80).trim()}…`;
}

export function HotIssueList({ topics, onTopicSelect }: HotIssueListProps) {
  const rows = topics.slice(0, 5);

  return (
    <section className="card-panel p-0">
      <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
        <h2 className="section-title">TODAY HOT ISSUES TOP 5</h2>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-4 text-xs text-[var(--text-secondary)]">표시할 글로벌 이슈가 없습니다.</div>
      ) : (
        <ul className="divide-y divide-[var(--border-default)]">
          {rows.map((topic) => {
            const summary = firstSentence(topic.summaryKo ?? topic.summaryEn ?? null);
            const flags = topic.regions
              .slice(0, 3)
              .map((regionId) => getRegionById(regionId)?.flagEmoji ?? "🌐")
              .join(" ");
            const title = topic.nameKo || topic.nameEn;
            const canOpenSheet = typeof topic.id === "number" && !!onTopicSelect;

            return (
              <li key={`hot-issue-${topic.id ?? topic.nameEn}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="card-title truncate">{title}</p>
                    {summary ? <p className="card-sub mt-1 line-clamp-1">{summary}</p> : null}
                    <p className="meta-xs mt-1">{flags}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="meta-xs">heat {Math.round(topic.totalHeatScore)}</p>
                    {typeof topic.id === "number" ? (
                      canOpenSheet ? (
                        <button
                          type="button"
                          onClick={() => onTopicSelect?.(topic.id!)}
                          className="mt-1 text-xs text-[var(--text-accent)] hover:underline"
                        >
                          상세 →
                        </button>
                      ) : (
                        <Link href={`/topic/${topic.id}`} className="mt-1 inline-block text-xs text-[var(--text-accent)] hover:underline">
                          상세 →
                        </Link>
                      )
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
