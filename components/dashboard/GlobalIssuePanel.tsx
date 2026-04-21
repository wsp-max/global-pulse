"use client";

import Link from "next/link";
import { getRegionById, type GlobalTopic } from "@global-pulse/shared";
import { useLanguage } from "@/lib/i18n/use-language";
import { cleanupTopicName } from "@/lib/utils/topic-name";

interface GlobalIssuePanelProps {
  topics: GlobalTopic[];
  maxItems?: number;
  onTopicSelect?: (topicId: number) => void;
}

function firstSentence(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (
    normalized.startsWith("요약 준비 중") ||
    normalized.startsWith("Summary pending") ||
    normalized.startsWith("Signals for") ||
    normalized.startsWith("핵심 키워드")
  ) {
    return null;
  }
  const first = normalized
    .split(/[.!?。！？]\s|$/u)
    .map((item) => item.trim())
    .filter(Boolean)[0];
  if (!first) {
    return null;
  }
  return first.length > 120 ? `${first.slice(0, 120).trimEnd()}…` : first;
}

function toSentimentLabel(value: number): string {
  if (value <= -0.6) return "매우 부정";
  if (value <= -0.2) return "부정";
  if (value < 0.2) return "중립";
  if (value < 0.6) return "긍정";
  return "매우 긍정";
}

export function GlobalIssuePanel({ topics, maxItems = 8, onTopicSelect }: GlobalIssuePanelProps) {
  const { t } = useLanguage("ko");
  const rows = topics.slice(0, maxItems);

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-card)]">
      <h2 className="section-title">Global Issues</h2>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
          {t("dashboard.empty.globalTopics")}. {t("dashboard.error.globalRetry")}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((topic) => {
            const cleaned = cleanupTopicName({
              id: topic.id,
              nameKo: topic.nameKo,
              nameEn: topic.nameEn,
              summaryKo: topic.summaryKo,
              summaryEn: topic.summaryEn,
              keywords: [],
              entities: null,
            });
            const sentimentEntries = Object.entries(topic.regionalSentiments ?? {});
            const primaryRegion =
              (topic.firstSeenRegion && getRegionById(topic.firstSeenRegion)) ||
              (topic.regions.length > 0 ? getRegionById(topic.regions[0]) : null);
            const summary = firstSentence(topic.summaryKo ?? null);

            const card = (
              <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4 transition-colors hover:border-[var(--border-hover)]">
                <p className="card-title">
                  {cleaned.displayKo}
                  {cleaned.isFallback ? (
                    <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                      {t("dashboard.badge.nameRefining")}
                    </span>
                  ) : null}
                </p>
                <p className="card-sub mt-1">
                  {topic.regions
                    .map((regionId) => {
                      const region = getRegionById(regionId);
                      return region ? `${region.flagEmoji} ${region.nameKo}` : regionId.toUpperCase();
                    })
                    .join(" · ")}
                </p>
                {summary ? <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--text-secondary)]">{summary}</p> : null}

                <div className="mt-3 space-y-1.5">
                  {sentimentEntries.slice(0, 3).map(([regionId, value]) => {
                    const region = getRegionById(regionId);
                    const width = Math.max(6, ((value + 1) / 2) * 100);
                    return (
                      <div key={`${topic.id}-${regionId}`} className="text-[11px]">
                        <div className="mb-1 flex items-center justify-between text-[var(--text-secondary)]">
                          <span>{region ? `${region.flagEmoji} ${region.nameKo}` : regionId}</span>
                          <span>{toSentimentLabel(value)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,var(--sentiment-negative),var(--sentiment-positive))]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="meta-xs mt-3">
                  Heat {Math.round(topic.totalHeatScore)}
                  {primaryRegion ? ` · 최초 감지 ${primaryRegion.flagEmoji} ${primaryRegion.nameKo}` : ""}
                </div>
              </article>
            );

            if (typeof topic.id === "number" && onTopicSelect) {
              return (
                <div
                  key={topic.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onTopicSelect(topic.id!)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onTopicSelect(topic.id!);
                    }
                  }}
                  className="block cursor-pointer text-left"
                >
                  {card}
                </div>
              );
            }

            if (typeof topic.id === "number") {
              return (
                <Link key={topic.id} href={`/topic/${topic.id}`}>
                  {card}
                </Link>
              );
            }

            return <div key={topic.nameEn}>{card}</div>;
          })}
        </div>
      )}
    </section>
  );
}
