"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HotIssueList } from "@/components/dashboard/HotIssueList";
import { RegionBoard } from "@/components/dashboard/RegionBoard";
import { ScopeTabs } from "@/components/dashboard/ScopeTabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import type { Topic } from "@global-pulse/shared";
import type { DashboardScope, GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";
import {
  buildGlobalTopicLookup,
  countQualifiedRoutes,
  getGlobalTopicIdentity,
  getScopeLongLabel,
  getScopeShortLabel,
  prepareQualifiedGlobalTopics,
} from "@/lib/utils/signal-quality";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

const WorldHeatMap = dynamic(() => import("./WorldHeatMap").then((mod) => mod.WorldHeatMap), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-[620px]" />,
});

const TopicDetailSheet = dynamic(() => import("./TopicDetailSheet").then((mod) => mod.TopicDetailSheet), {
  ssr: false,
});

interface DashboardClientProps {
  initialCommunityRegions?: RegionsApiResponse;
  initialNewsRegions?: RegionsApiResponse;
  initialCommunityGlobalTopics?: GlobalTopicsApiResponse;
  initialNewsGlobalTopics?: GlobalTopicsApiResponse;
  scope?: DashboardScope;
  initialRegions?: RegionsApiResponse;
  initialGlobalTopics?: GlobalTopicsApiResponse;
}

type HomeScope = "community" | "news";
type DashboardPeriod = "24h" | "7d";

const MAIN_REGION_ORDER = ["us", "cn", "jp", "kr", "eu", "in", "br", "ru"] as const;

function parseScope(input: string | null): HomeScope {
  return input === "news" ? "news" : "community";
}

function parsePeriod(input: string | null): DashboardPeriod {
  return input === "7d" ? "7d" : "24h";
}

function applyPeriodFilter(period: DashboardPeriod, periodEnd: string): boolean {
  if (period === "7d") {
    return true;
  }

  const endMs = new Date(periodEnd).getTime();
  if (!Number.isFinite(endMs)) {
    return true;
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return endMs >= cutoff;
}

function sortRegions<T extends { id: string; totalHeatScore: number }>(regions: T[]): T[] {
  return [...regions].sort((left, right) => {
    const leftIndex = MAIN_REGION_ORDER.indexOf(left.id as (typeof MAIN_REGION_ORDER)[number]);
    const rightIndex = MAIN_REGION_ORDER.indexOf(right.id as (typeof MAIN_REGION_ORDER)[number]);
    const lp = leftIndex < 0 ? 99 : leftIndex;
    const rp = rightIndex < 0 ? 99 : rightIndex;
    if (lp !== rp) {
      return lp - rp;
    }
    return (right.totalHeatScore ?? 0) - (left.totalHeatScore ?? 0);
  });
}

function filterRegionPayload(
  regions: RegionsApiResponse["regions"],
  period: DashboardPeriod,
): RegionsApiResponse["regions"] {
  return sortRegions(regions)
    .map((region) => {
      const topics = region.topTopics.filter((topic) => applyPeriodFilter(period, topic.periodEnd));
      const totalHeatScore = topics.reduce((sum, topic) => sum + (topic.heatScore ?? 0), 0);
      return {
        ...region,
        topTopics: topics,
        totalHeatScore: topics.length > 0 ? totalHeatScore : region.totalHeatScore,
        activeTopics: topics.length,
      };
    })
    .filter((region) => region.topTopics.length > 0 || (region.totalHeatScore ?? 0) > 0);
}

function findHottestTopic(regions: RegionsApiResponse["regions"]): Topic | null {
  let hottest: Topic | null = null;

  for (const region of regions) {
    for (const topic of region.topTopics) {
      if (!hottest || (topic.heatScore ?? 0) > (hottest.heatScore ?? 0)) {
        hottest = topic;
      }
    }
  }

  return hottest;
}

export function DashboardClient({
  initialCommunityRegions,
  initialNewsRegions,
  initialCommunityGlobalTopics,
  initialNewsGlobalTopics,
  scope = "community",
  initialRegions,
  initialGlobalTopics,
}: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const defaultScope: HomeScope = scope === "news" ? "news" : "community";
  const activeScope = parseScope(searchParams.get("scope") ?? defaultScope);
  const secondaryScope: HomeScope = activeScope === "community" ? "news" : "community";
  const period = parsePeriod(searchParams.get("period"));

  const communityRegionFallback = initialCommunityRegions ?? (defaultScope === "community" ? initialRegions : undefined);
  const newsRegionFallback = initialNewsRegions ?? (defaultScope === "news" ? initialRegions : undefined);
  const communityGlobalFallback =
    initialCommunityGlobalTopics ?? (defaultScope === "community" ? initialGlobalTopics : undefined);
  const newsGlobalFallback =
    initialNewsGlobalTopics ?? (defaultScope === "news" ? initialGlobalTopics : undefined);

  const communityRegions = useRegions("community", { fallbackData: communityRegionFallback });
  const newsRegions = useRegions("news", { fallbackData: newsRegionFallback });
  const communityGlobalTopics = useGlobalTopics(30, "community", { fallbackData: communityGlobalFallback });
  const newsGlobalTopics = useGlobalTopics(30, "news", { fallbackData: newsGlobalFallback });

  const primaryRegionsData = activeScope === "community" ? communityRegions.data : newsRegions.data;
  const secondaryRegionsData = activeScope === "community" ? newsRegions.data : communityRegions.data;
  const primaryGlobalData = activeScope === "community" ? communityGlobalTopics.data : newsGlobalTopics.data;
  const secondaryGlobalData = activeScope === "community" ? newsGlobalTopics.data : communityGlobalTopics.data;
  const isRegionsLoading = activeScope === "community" ? communityRegions.isLoading : newsRegions.isLoading;
  const isGlobalLoading = activeScope === "community" ? communityGlobalTopics.isLoading : newsGlobalTopics.isLoading;
  const regionsError = activeScope === "community" ? communityRegions.error : newsRegions.error;
  const globalError = activeScope === "community" ? communityGlobalTopics.error : newsGlobalTopics.error;

  const filteredPrimaryRegions = useMemo(
    () => filterRegionPayload(primaryRegionsData?.regions ?? [], period),
    [period, primaryRegionsData?.regions],
  );
  const filteredSecondaryRegions = useMemo(
    () => filterRegionPayload(secondaryRegionsData?.regions ?? [], period),
    [period, secondaryRegionsData?.regions],
  );

  const primaryGlobalTopics = useMemo(() => primaryGlobalData?.globalTopics ?? [], [primaryGlobalData?.globalTopics]);
  const secondaryGlobalTopics = useMemo(() => secondaryGlobalData?.globalTopics ?? [], [secondaryGlobalData?.globalTopics]);

  const qualifiedPrimaryGlobalTopics = useMemo(
    () => prepareQualifiedGlobalTopics(primaryGlobalTopics, activeScope),
    [primaryGlobalTopics, activeScope],
  );
  const qualifiedSecondaryGlobalTopics = useMemo(
    () => prepareQualifiedGlobalTopics(secondaryGlobalTopics, secondaryScope),
    [secondaryGlobalTopics, secondaryScope],
  );

  const topGlobalIssues = useMemo(
    () => [...qualifiedPrimaryGlobalTopics].sort((left, right) => (right.totalHeatScore ?? 0) - (left.totalHeatScore ?? 0)).slice(0, 5),
    [qualifiedPrimaryGlobalTopics],
  );

  const topGlobalTopicIds = useMemo(
    () => new Set(topGlobalIssues.flatMap((globalTopic) => globalTopic.topicIds ?? [])),
    [topGlobalIssues],
  );

  const secondaryLookup = useMemo(
    () => buildGlobalTopicLookup(qualifiedSecondaryGlobalTopics),
    [qualifiedSecondaryGlobalTopics],
  );

  const sharedQualifiedCount = useMemo(
    () =>
      qualifiedPrimaryGlobalTopics.reduce((sum, topic) => {
        const identity = getGlobalTopicIdentity(topic);
        return identity && secondaryLookup.has(identity) ? sum + 1 : sum;
      }, 0),
    [qualifiedPrimaryGlobalTopics, secondaryLookup],
  );

  const primaryRouteCount = useMemo(
    () => countQualifiedRoutes(primaryGlobalTopics, activeScope),
    [primaryGlobalTopics, activeScope],
  );
  const secondaryRouteCount = useMemo(
    () => countQualifiedRoutes(secondaryGlobalTopics, secondaryScope),
    [secondaryGlobalTopics, secondaryScope],
  );

  const hottestTopic = useMemo(() => findHottestTopic(filteredPrimaryRegions), [filteredPrimaryRegions]);
  const hottestTopicTitle = hottestTopic
    ? getDisplayTopicName({
        id: hottestTopic.id,
        regionId: hottestTopic.regionId,
        nameKo: hottestTopic.nameKo,
        nameEn: hottestTopic.nameEn,
        summaryKo: hottestTopic.summaryKo,
        summaryEn: hottestTopic.summaryEn,
        sampleTitles: hottestTopic.sampleTitles,
        keywords: hottestTopic.keywords,
        entities: hottestTopic.entities ?? [],
      })
    : null;

  const applyQuery = (next: { period?: DashboardPeriod; scope?: HomeScope }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", next.period ?? period);
    params.set("scope", next.scope ?? activeScope);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const primaryScopeLabel = getScopeLongLabel(activeScope);
  const secondaryScopeLabel = getScopeLongLabel(secondaryScope);
  const primaryScopeShortLabel = getScopeShortLabel(activeScope);
  const secondaryScopeShortLabel = getScopeShortLabel(secondaryScope);

  return (
    <main className="page-shell">
      <section className="card-panel p-2">
        <div className="flex min-h-7 flex-wrap items-center gap-3 px-2 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            LIVE
          </span>

          {hottestTopic ? (
            <span className="truncate">
              {primaryScopeLabel}에서 가장 뜨거운 이슈: <span className="text-[var(--text-primary)]">{hottestTopicTitle}</span> · heat {Math.round(hottestTopic.heatScore)}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-[var(--border-default)] p-0.5">
              {(["24h", "7d"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => applyQuery({ period: item })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    period === item
                      ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ScopeTabs
        value={activeScope}
        onChange={(nextScope) => applyQuery({ scope: nextScope === "news" ? "news" : "community" })}
      />

      <section className="grid gap-3 md:grid-cols-4">
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">primary</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{primaryScopeLabel}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">활성 지역 {filteredPrimaryRegions.length} · 글로벌 확산 이슈 {qualifiedPrimaryGlobalTopics.length}</p>
        </article>
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">routes</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{primaryRouteCount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">{primaryScopeShortLabel} confirmed propagation routes</p>
        </article>
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">cross-check</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sharedQualifiedCount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">{secondaryScopeLabel}에서도 포착된 상위 이슈 수</p>
        </article>
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">secondary</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{secondaryRouteCount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">{secondaryScopeShortLabel} confirmed routes</p>
        </article>
      </section>

      {regionsError ? <EmptyState title="지역 데이터를 불러오지 못했습니다." description="잠시 후 다시 새로고침해 주세요." /> : null}
      {isRegionsLoading ? <LoadingSkeleton className="h-[720px]" /> : null}

      {!regionsError && !isRegionsLoading && filteredPrimaryRegions.length === 0 ? (
        <EmptyState title="표시할 지역 데이터가 없습니다." description="현재 배치에 지역별 이슈가 충분히 쌓이지 않았습니다." />
      ) : null}

      {!regionsError && filteredPrimaryRegions.length > 0 ? (
        <>
          <section>
            <RegionBoard
              regions={filteredPrimaryRegions}
              secondaryRegions={filteredSecondaryRegions}
              primaryScope={activeScope}
              secondaryScope={secondaryScope}
              topGlobalTopicIds={topGlobalTopicIds}
              onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
              exploreHref={`/global-issues?view=regions&scope=${activeScope}&period=${period}`}
            />
          </section>

          <section>
            {isGlobalLoading ? (
              <LoadingSkeleton className="h-44" />
            ) : globalError ? (
              <EmptyState title="글로벌 이슈를 불러오지 못했습니다." description="잠시 후 다시 시도해 주세요." />
            ) : (
              <HotIssueList
                topics={topGlobalIssues}
                scope={activeScope}
                comparisonTopics={qualifiedSecondaryGlobalTopics}
                comparisonScope={secondaryScope}
                onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
              />
            )}
          </section>

          <section className="card-panel p-4">
            <WorldHeatMap
              regions={filteredPrimaryRegions}
              globalTopics={qualifiedPrimaryGlobalTopics}
              comparisonGlobalTopics={qualifiedSecondaryGlobalTopics}
              comparisonScope={secondaryScope}
              variant={activeScope}
              onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
            />
          </section>
        </>
      ) : null}

      <TopicDetailSheet topicId={selectedTopicId} onClose={() => setSelectedTopicId(null)} />
    </main>
  );
}
