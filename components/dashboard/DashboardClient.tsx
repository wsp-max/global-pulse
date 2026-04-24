"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { GlobalTopic, Topic } from "@global-pulse/shared";
import { HealthStrip } from "@/components/dashboard/HealthStrip";
import { HotIssueList } from "@/components/dashboard/HotIssueList";
import { PropagationEventList } from "@/components/dashboard/PropagationEventList";
import { RegionBoard } from "@/components/dashboard/RegionBoard";
import { ScopeTabs } from "@/components/dashboard/ScopeTabs";
import { SourceTransferPanel } from "@/components/dashboard/SourceTransferPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import type { DashboardScope, GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";
import {
  buildGlobalTopicComparisonBadge,
  buildGlobalTopicLookup,
  countQualifiedRoutes,
  getGlobalTopicIdentity,
  getScopeShortLabel,
  prepareQualifiedGlobalTopics,
} from "@/lib/utils/signal-quality";
import {
  buildNarrativeSummary,
  formatLagKorean,
  resolveNarrativeStage,
  toNarrativeStageLabel,
  type NarrativeStageKey,
} from "@/lib/utils/topic-narrative";
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
const SCOPE_INTRO_STORAGE_KEY = "gp_scope_intro_seen_v1";

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

function stageToneClass(stage: NarrativeStageKey): string {
  if (stage === "fading") return "border-slate-400/40 bg-slate-500/10 text-slate-200";
  if (stage === "peaking") return "border-amber-400/50 bg-amber-500/10 text-amber-200";
  if (stage === "spreading") return "border-cyan-400/40 bg-cyan-500/10 text-cyan-200";
  return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
}

function buildStoryRouteText(topic: GlobalTopic): string {
  const timeline = [...(topic.propagationTimeline ?? [])]
    .filter((point) => point.firstPostAt)
    .sort((left, right) => new Date(left.firstPostAt).getTime() - new Date(right.firstPostAt).getTime());

  if (timeline.length >= 2) {
    const origin = timeline[0]!;
    const originTime = new Date(origin.firstPostAt).getTime();
    const destinations = timeline.slice(1, 3).map((point) => {
      const currentTime = new Date(point.firstPostAt).getTime();
      const lagMinutes = Number.isFinite(originTime) && Number.isFinite(currentTime)
        ? (currentTime - originTime) / 60_000
        : 0;
      return `${point.regionId.toUpperCase()} ${formatLagKorean(lagMinutes)}`;
    });

    return `${origin.regionId.toUpperCase()}에서 먼저 → ${destinations.join(", ")}`;
  }

  const edges = (topic.propagationEdges ?? [])
    .filter((edge) => edge && edge.from && edge.to)
    .sort((left, right) => (left.lagMinutes ?? 0) - (right.lagMinutes ?? 0))
    .slice(0, 2);

  if (edges.length > 0) {
    return edges
      .map((edge) => `${edge.from.toUpperCase()} -> ${edge.to.toUpperCase()} ${formatLagKorean(edge.lagMinutes ?? 0)}`)
      .join(", ");
  }

  return "확산 경로 데이터 수집 중";
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
  const [showScopeIntro, setShowScopeIntro] = useState(false);

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
  const communityGlobalTopics = useGlobalTopics(180, "community", { fallbackData: communityGlobalFallback });
  const newsGlobalTopics = useGlobalTopics(90, "news", { fallbackData: newsGlobalFallback });

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

  const topStoryTopics = useMemo(
    () =>
      [...qualifiedPrimaryGlobalTopics]
        .sort((left, right) => {
          const velocityDelta = (right.velocityPerHour ?? 0) - (left.velocityPerHour ?? 0);
          if (velocityDelta !== 0) return velocityDelta;
          const spreadDelta = (right.spreadScore ?? 0) - (left.spreadScore ?? 0);
          if (spreadDelta !== 0) return spreadDelta;
          return (right.totalHeatScore ?? 0) - (left.totalHeatScore ?? 0);
        })
        .slice(0, 3),
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

  const primaryRegionalTopics = useMemo(
    () => filteredPrimaryRegions.flatMap((region) => region.topTopics),
    [filteredPrimaryRegions],
  );

  const topicById = useMemo(() => {
    const lookup = new Map<number, Topic>();
    for (const topic of primaryRegionalTopics) {
      if (typeof topic.id === "number") {
        lookup.set(topic.id, topic);
      }
    }
    return lookup;
  }, [primaryRegionalTopics]);

  const { isWatched, toggleWatch } = useWatchlist(primaryRegionalTopics);
  const selectedTopicForWatch = selectedTopicId ? topicById.get(selectedTopicId) ?? null : null;

  const applyQuery = (next: { period?: DashboardPeriod; scope?: HomeScope }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", next.period ?? period);
    params.set("scope", next.scope ?? activeScope);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const secondaryScopeShortLabel = getScopeShortLabel(secondaryScope);

  useEffect(() => {
    const seen = window.localStorage.getItem(SCOPE_INTRO_STORAGE_KEY);
    if (!seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time onboarding visibility sync
      setShowScopeIntro(true);
    }
  }, []);

  return (
    <main className="page-shell">
      <section className="card-panel p-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <HealthStrip hottestLabel={hottestTopicTitle} hottestHeat={hottestTopic?.heatScore ?? null} />
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

      <section className="card-panel p-3 text-sm text-[var(--text-secondary)]">
        커뮤니티 발 신호와 언론 보도 신호를 나란히 놓고 교차검증합니다.
      </section>

      {showScopeIntro ? (
        <section className="card-panel p-3">
          <div className="flex items-start justify-between gap-3 text-xs text-[var(--text-secondary)]">
            <p>
              커뮤니티 탭: reddit · dcinside
              <br />
              뉴스 탭: 주요 매체 · YouTube
            </p>
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem(SCOPE_INTRO_STORAGE_KEY, "1");
                setShowScopeIntro(false);
              }}
              className="rounded-md border border-[var(--border-default)] px-2 py-1 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              확인
            </button>
          </div>
        </section>
      ) : null}

      <ScopeTabs
        value={activeScope}
        onChange={(nextScope) => applyQuery({ scope: nextScope === "news" ? "news" : "community" })}
      />

      <SourceTransferPanel primaryScope={activeScope} />

      <section>
        <div className="mb-2 px-1">
          <h2 className="section-title">오늘의 확산 스토리 Top 3</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">지금 가장 빠르게 번지는 이슈와 확산 경로를 요약합니다.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {topStoryTopics.map((topic) => {
          const displayName = getDisplayTopicName({
            id: topic.id,
            nameKo: topic.nameKo,
            nameEn: topic.nameEn,
            summaryKo: topic.summaryKo,
            summaryEn: topic.summaryEn,
          });
          const stage = resolveNarrativeStage({
            velocityPerHour: topic.velocityPerHour,
            acceleration: topic.acceleration,
            spreadScore: topic.spreadScore,
          });
          const summary = buildNarrativeSummary({
            summaryKo: topic.summaryKo,
            summaryEn: topic.summaryEn,
            fallbackText: "확산 핵심 신호를 정리 중입니다.",
            maxLength: 110,
          });
          const comparisonBadge = buildGlobalTopicComparisonBadge(topic, secondaryLookup, activeScope);
          const leadTopicId = (topic.topicIds ?? []).find((id) => topicById.has(id));
          const leadTopic = leadTopicId ? topicById.get(leadTopicId) ?? null : null;
          const tracked = leadTopic ? isWatched(leadTopic.id) : false;

          return (
            <article key={`story-${topic.id ?? topic.nameEn}`} className="card-panel p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words text-sm font-semibold text-[var(--text-primary)]">{displayName}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${stageToneClass(stage)}`}>
                  {toNarrativeStageLabel(stage)}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 break-words text-[11px] text-[var(--text-secondary)]">{topic.nameEn}</p>
              <p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-[var(--text-secondary)]">{summary}</p>
              <p className="mt-2 line-clamp-2 break-words text-xs text-[var(--text-primary)]">{buildStoryRouteText(topic)}</p>
              <span className="mt-2 inline-flex rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                {comparisonBadge.label}
              </span>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!leadTopic}
                  onClick={() => {
                    if (leadTopic) {
                      toggleWatch(leadTopic);
                    }
                  }}
                  className="rounded-md border border-[var(--border-default)] px-2 py-1 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tracked ? "추적 중" : "이 이슈 추적"}
                </button>
                {typeof topic.id === "number" ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTopicId(topic.id!)}
                    className="rounded-md border border-[var(--border-default)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                  >
                    상세
                  </button>
                ) : null}
              </div>
            </article>
          );
          })}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">quality</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">확산 근거 통과</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">{qualifiedPrimaryGlobalTopics.length.toLocaleString()}개 이슈</p>
        </article>
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">routes</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{primaryRouteCount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">확산이 확인된 이슈 수</p>
        </article>
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">cross-check</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sharedQualifiedCount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">커뮤니티·뉴스 양쪽에서 포착</p>
        </article>
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">secondary</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{secondaryRouteCount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">{secondaryScopeShortLabel} 확산 확인</p>
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

          <section className="grid gap-3 lg:grid-cols-[minmax(0,2.1fr)_minmax(280px,1fr)]">
            <div className="card-panel p-4">
              <WorldHeatMap
                regions={filteredPrimaryRegions}
                globalTopics={qualifiedPrimaryGlobalTopics}
                comparisonGlobalTopics={qualifiedSecondaryGlobalTopics}
                comparisonScope={secondaryScope}
                variant={activeScope}
                onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
              />
            </div>
            <PropagationEventList
              topics={qualifiedPrimaryGlobalTopics}
              scope={activeScope}
              onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
            />
          </section>
        </>
      ) : null}

      <TopicDetailSheet
        topicId={selectedTopicId}
        onClose={() => setSelectedTopicId(null)}
        isWatched={selectedTopicForWatch ? isWatched(selectedTopicForWatch.id) : false}
        onToggleWatch={selectedTopicForWatch ? () => toggleWatch(selectedTopicForWatch) : undefined}
      />
    </main>
  );
}
