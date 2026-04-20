"use client";

import Link from "next/link";
import type { RegionDashboardRow } from "@/lib/types/api";

const MAIN_REGION_ORDER = ["us", "cn", "jp", "kr", "eu", "in", "br", "ru"] as const;
const TOPICS_PER_REGION = 3;

interface RegionBoardProps {
  regions: RegionDashboardRow[];
  topGlobalTopicIds: Set<number>;
  onTopicSelect: (topicId: number) => void;
}

export function RegionBoard({ regions, topGlobalTopicIds, onTopicSelect }: RegionBoardProps) {
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
    <section className="card-panel p-0">
      <header className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
        <h2 className="section-title">REGION BOARD</h2>
        <span className="text-[11px] text-[var(--text-secondary)]">각 지역 상위 {TOPICS_PER_REGION}개 토픽</span>
      </header>

      <div className="grid grid-cols-1 gap-px bg-[var(--border-default)] sm:grid-cols-2 xl:grid-cols-4">
        {active.map((region) => (
          <article key={region.id} className="flex flex-col gap-2 bg-[var(--bg-primary)] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/region/${region.id}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)]"
              >
                <span aria-hidden>{region.flagEmoji}</span>
                {region.nameKo}
              </Link>
              <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                heat {Math.round(region.totalHeatScore ?? 0).toLocaleString()}
              </span>
            </div>

            <ul className="flex flex-col gap-1.5">
              {region.topTopics.slice(0, TOPICS_PER_REGION).map((topic, index) => {
                const topicId = typeof topic.id === "number" ? topic.id : null;
                const isGlobal = topicId !== null && topGlobalTopicIds.has(topicId);

                return (
                  <li key={topic.id ?? `${region.id}-${index}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (topicId !== null) {
                          onTopicSelect(topicId);
                        }
                      }}
                      className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-secondary)]"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate">
                          <span className="mr-1 text-[var(--text-secondary)]">#{index + 1}</span>
                          <span className="text-[var(--text-primary)]">{topic.nameKo || topic.nameEn}</span>
                          {isGlobal ? (
                            <span className="ml-1 rounded border border-[var(--border-default)] px-1 py-0.5 text-[9px] text-[var(--text-accent)]">
                              GLOBAL
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-[var(--text-secondary)]">
                          {Math.round(topic.heatScore).toLocaleString()}
                        </span>
                      </span>
                      {topic.summaryKo ? (
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--text-secondary)]">{topic.summaryKo}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
