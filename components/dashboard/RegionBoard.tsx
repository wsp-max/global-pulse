"use client";

import Link from "next/link";
import type { RegionDashboardRow } from "@/lib/types/api";
import {
  buildRegionComparisonSummary,
  getScopeShortLabel,
  type SourceComparisonBadge,
} from "@/lib/utils/signal-quality";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

const MAIN_REGION_ORDER = ["us", "cn", "jp", "kr", "eu", "in", "br", "ru"] as const;
const TOPICS_PER_REGION = 3;

interface RegionBoardProps {
  regions: RegionDashboardRow[];
  secondaryRegions?: RegionDashboardRow[];
  primaryScope: "community" | "news";
  secondaryScope: "community" | "news";
  topGlobalTopicIds: Set<number>;
  onTopicSelect: (topicId: number) => void;
  exploreHref?: string;
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

export function RegionBoard({
  regions,
  secondaryRegions = [],
  primaryScope,
  secondaryScope,
  topGlobalTopicIds,
  onTopicSelect,
  exploreHref,
}: RegionBoardProps) {
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
  const secondaryRegionMap = new Map(secondaryRegions.map((region) => [region.id, region]));
  const secondaryScopeShortLabel = getScopeShortLabel(secondaryScope);

  return (
    <section className="card-panel p-0">
      <header className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
        <div>
          <h2 className="section-title">REGION BOARD</h2>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">선택 source 기준 상위 지역 이슈와 반대 source 확인 신호를 함께 보여줍니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--text-secondary)]">각 지역 상위 {TOPICS_PER_REGION}개 토픽</span>
          {exploreHref ? (
            <Link href={exploreHref} className="text-[11px] text-[var(--text-accent)] hover:underline">
              Region Explorer →
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-px bg-[var(--border-default)] sm:grid-cols-2 xl:grid-cols-4">
        {active.map((region) => {
          const comparison = buildRegionComparisonSummary(region, secondaryRegionMap.get(region.id), primaryScope);

          return (
            <article key={region.id} className="flex flex-col gap-2 bg-[var(--bg-primary)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/region/${region.id}`}
                    className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)]"
                  >
                    <span aria-hidden>{region.flagEmoji}</span>
                    {region.nameKo}
                  </Link>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {secondaryScopeShortLabel} heat {Math.round(comparison.secondaryHeat).toLocaleString()} · overlap {comparison.overlapCount}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                    heat {Math.round(region.totalHeatScore ?? 0).toLocaleString()}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badgeToneClass(comparison.badge.tone)}`}>
                    {comparison.badge.label}
                  </span>
                </div>
              </div>

              <ul className="flex flex-col gap-1.5">
                {region.topTopics.slice(0, TOPICS_PER_REGION).map((topic, index) => {
                  const topicId = typeof topic.id === "number" ? topic.id : null;
                  const isGlobal = topicId !== null && topGlobalTopicIds.has(topicId);
                  const title = getDisplayTopicName({
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
                            <span className="text-[var(--text-primary)]">{title}</span>
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
          );
        })}
      </div>
    </section>
  );
}
