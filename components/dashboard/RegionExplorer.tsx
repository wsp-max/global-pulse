"use client";

import Link from "next/link";
import type { RegionDashboardRow } from "@/lib/types/api";
import { cleanupTopicName } from "@/lib/utils/topic-name";

const MAIN_REGION_ORDER = ["us", "cn", "jp", "kr", "eu", "in", "br", "ru"] as const;
const TOPICS_PER_REGION = 12;

interface RegionExplorerProps {
  regions: RegionDashboardRow[];
  topGlobalTopicIds?: Set<number>;
  onTopicSelect: (topicId: number) => void;
}

export function RegionExplorer({ regions, topGlobalTopicIds = new Set<number>(), onTopicSelect }: RegionExplorerProps) {
  const sorted = [...regions].sort((left, right) => {
    const leftIndex = MAIN_REGION_ORDER.indexOf(left.id as (typeof MAIN_REGION_ORDER)[number]);
    const rightIndex = MAIN_REGION_ORDER.indexOf(right.id as (typeof MAIN_REGION_ORDER)[number]);
    const lp = leftIndex < 0 ? 99 : leftIndex;
    const rp = rightIndex < 0 ? 99 : rightIndex;
    if (lp !== rp) {
      return lp - rp;
    }
    return (right.totalHeatScore ?? 0) - (left.totalHeatScore ?? 0);
  });

  const active = sorted.filter((region) => region.topTopics.length > 0);

  return (
    <section className="space-y-4">
      {active.map((region) => (
        <article key={region.id} className="card-panel p-0">
          <header className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
            <div>
              <Link
                href={`/region/${region.id}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)]"
              >
                <span aria-hidden>{region.flagEmoji}</span>
                {region.nameKo}
              </Link>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                총 heat {Math.round(region.totalHeatScore ?? 0).toLocaleString()} · {Math.min(region.topTopics.length, TOPICS_PER_REGION)}개 이슈
              </p>
            </div>
            <span className="text-[11px] text-[var(--text-secondary)]">Region Explorer</span>
          </header>

          <div className="grid gap-px bg-[var(--border-default)] md:grid-cols-2 xl:grid-cols-3">
            {region.topTopics.slice(0, TOPICS_PER_REGION).map((topic, index) => {
              const cleaned = cleanupTopicName({
                id: topic.id,
                regionId: topic.regionId,
                nameKo: topic.nameKo,
                nameEn: topic.nameEn,
                summaryKo: topic.summaryKo,
                summaryEn: topic.summaryEn,
                sampleTitles: topic.sampleTitles,
                keywords: topic.keywords,
                entities: topic.entities ?? [],
              });
              const topicId = typeof topic.id === "number" ? topic.id : null;
              const isGlobal = topicId !== null && topGlobalTopicIds.has(topicId);
              const summary = topic.summaryKo || topic.summaryEn || "요약 준비 중";

              return (
                <div
                  key={topic.id ?? `${region.id}-${index}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (topicId !== null) {
                      onTopicSelect(topicId);
                    }
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && topicId !== null) {
                      event.preventDefault();
                      onTopicSelect(topicId);
                    }
                  }}
                  className="flex min-h-[168px] cursor-pointer flex-col gap-3 bg-[var(--bg-primary)] p-4 text-left transition hover:bg-[var(--bg-secondary)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        #{index + 1}
                        {isGlobal ? (
                          <span className="ml-2 rounded border border-[var(--border-default)] px-1 py-0.5 text-[9px] text-[var(--text-accent)]">
                            GLOBAL
                          </span>
                        ) : null}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">
                        {cleaned.displayKo || cleaned.displayEn}
                      </h3>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--text-secondary)]">
                      heat {Math.round(topic.heatScore).toLocaleString()}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-[12px] leading-snug text-[var(--text-secondary)]">{summary}</p>

                  <div className="mt-auto flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>posts {topic.postCount.toLocaleString()}</span>
                    <span>{topic.lifecycleStage ?? "emerging"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </section>
  );
}
