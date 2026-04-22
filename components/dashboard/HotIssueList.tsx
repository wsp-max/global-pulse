"use client";

import Link from "next/link";
import { getRegionById, type GlobalTopic } from "@global-pulse/shared";
import {
  buildGlobalTopicComparisonBadge,
  buildGlobalTopicLookup,
  getScopeLongLabel,
  type SourceComparisonBadge,
  prepareQualifiedGlobalTopics,
} from "@/lib/utils/signal-quality";
import { buildNarrativeSummary } from "@/lib/utils/topic-narrative";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

interface HotIssueListProps {
  topics: GlobalTopic[];
  scope?: "community" | "news";
  comparisonTopics?: GlobalTopic[];
  comparisonScope?: "community" | "news";
  onTopicSelect?: (topicId: number) => void;
}

function badgeToneClass(tone: SourceComparisonBadge["tone"]): string {
  if (tone === "match") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (tone === "lead") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-200";
  }
  if (tone === "confirm") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  if (tone === "solo") {
    return "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200";
  }
  return "border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]";
}

export function HotIssueList({
  topics,
  scope = "community",
  comparisonTopics = [],
  comparisonScope = scope === "community" ? "news" : "community",
  onTopicSelect,
}: HotIssueListProps) {
  const rows = prepareQualifiedGlobalTopics(topics, scope)
    .sort((left, right) => (right.totalHeatScore ?? 0) - (left.totalHeatScore ?? 0))
    .slice(0, 5);

  const comparisonLookup = buildGlobalTopicLookup(prepareQualifiedGlobalTopics(comparisonTopics, comparisonScope));
  const scopeLabel = getScopeLongLabel(scope);

  return (
    <section className="card-panel p-0">
      <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
        <div>
          <h2 className="section-title">CONFIRMED GLOBAL ISSUES</h2>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{scopeLabel} 기준 확산 근거를 통과한 이슈만 노출합니다.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-4 text-xs text-[var(--text-secondary)]">현재 배치에서 확산 근거를 통과한 글로벌 이슈가 없습니다.</div>
      ) : (
        <ul className="divide-y divide-[var(--border-default)]">
          {rows.map((topic) => {
            const summary = buildNarrativeSummary({
              summaryKo: topic.summaryKo,
              summaryEn: topic.summaryEn,
              fallbackText: "관련 글로벌 이슈를 수집 중입니다.",
              maxLength: 90,
            });
            const flags = topic.regions
              .slice(0, 3)
              .map((regionId) => getRegionById(regionId)?.flagEmoji ?? "🌐")
              .join(" ");
            const title = getDisplayTopicName({
              id: topic.id,
              nameKo: topic.nameKo,
              nameEn: topic.nameEn,
              summaryKo: topic.summaryKo,
              summaryEn: topic.summaryEn,
            });
            const canOpenSheet = typeof topic.id === "number" && !!onTopicSelect;
            const badge = buildGlobalTopicComparisonBadge(topic, comparisonLookup, scope);

            return (
              <li key={`hot-issue-${topic.id ?? topic.nameEn}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="card-title truncate">{title}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badgeToneClass(badge.tone)}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="card-sub mt-1 line-clamp-1">{summary}</p>
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
