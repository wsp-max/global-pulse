"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { GlobalTopic, Topic } from "@global-pulse/shared";
import {
  GlobalIssuePanel,
  LivePulseStrip,
  PropagationMatrix,
  PulseSignalBoard,
  RegionCard,
  WatchBell,
} from "@/components/dashboard";
import { CompareDrawer } from "@/components/dashboard/CompareDrawer";
import { FilterBar, type DashboardFilters } from "@/components/dashboard/FilterBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { useLanguage } from "@/lib/i18n/use-language";
import type { DashboardScope, GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";
import { cleanupTopicName } from "@/lib/utils/topic-name";

const WorldHeatMap = dynamic(
  () => import("./WorldHeatMap").then((mod) => mod.WorldHeatMap),
  {
    ssr: false,
    loading: () => <LoadingSkeleton className="h-[360px]" />,
  },
);

const PropagationStream = dynamic(
  () => import("./PropagationStream").then((mod) => mod.PropagationStream),
  {
    ssr: false,
    loading: () => <LoadingSkeleton className="h-[280px]" />,
  },
);

const TopicDetailSheet = dynamic(
  () => import("./TopicDetailSheet").then((mod) => mod.TopicDetailSheet),
  {
    ssr: false,
  },
);

const PERIOD_HOURS: Record<DashboardFilters["period"], number> = {
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "7d": 24 * 7,
};

const MAIN_REGION_ORDER = ["us", "cn", "jp", "kr", "eu", "in", "br", "ru"] as const;

const DEFAULT_FILTERS: DashboardFilters = {
  category: "all",
  period: "24h",
  sentiment: "all",
  scope: "community",
  minZ: 0,
  q: "",
};

function parseScope(input: string | null, fallback: DashboardScope): DashboardScope {
  if (input === "news" || input === "mixed" || input === "community") {
    return input;
  }
  return fallback;
}

function parseFilters(params: URLSearchParams, fallbackScope: DashboardScope): DashboardFilters {
  const periodInput = params.get("period");
  const sentimentInput = params.get("sentiment");
  const period: DashboardFilters["period"] =
    periodInput === "1h" || periodInput === "6h" || periodInput === "24h" || periodInput === "7d"
      ? periodInput
      : DEFAULT_FILTERS.period;
  const sentiment: DashboardFilters["sentiment"] =
    sentimentInput === "pos" || sentimentInput === "neg" || sentimentInput === "controversial"
      ? sentimentInput
      : "all";
  const minZInput = Number(params.get("minZ") ?? "0");

  return {
    category: (params.get("category") ?? "all").trim() || "all",
    period,
    sentiment,
    scope: parseScope(params.get("scope"), fallbackScope),
    minZ: Number.isFinite(minZInput) ? Math.max(0, minZInput) : 0,
    q: (params.get("q") ?? "").trim(),
  };
}

function buildQueryString(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.period !== DEFAULT_FILTERS.period) params.set("period", filters.period);
  if (filters.sentiment !== "all") params.set("sentiment", filters.sentiment);
  if (filters.scope !== DEFAULT_FILTERS.scope) params.set("scope", filters.scope);
  if (filters.minZ > 0) params.set("minZ", String(Number(filters.minZ.toFixed(1))));
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

function averageSentiment(topic: GlobalTopic): number {
  const values = Object.values(topic.regionalSentiments ?? {}).filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isControversialTopic(topic: Topic): boolean {
  const distribution = topic.sentimentDistribution;
  if (!distribution) {
    return false;
  }
  return (
    distribution.controversial >= 0.25 ||
    (distribution.positive >= 0.25 && distribution.negative >= 0.25)
  );
}

function matchesTopicFilters(topic: Topic, filters: DashboardFilters, nowMs: number): boolean {
  if (filters.category !== "all" && topic.category !== filters.category) {
    return false;
  }

  if (filters.period !== "7d") {
    const endMs = new Date(topic.periodEnd).getTime();
    const cutoff = nowMs - PERIOD_HOURS[filters.period] * 60 * 60 * 1000;
    if (Number.isFinite(endMs) && endMs < cutoff) {
      return false;
    }
  }

  if (filters.sentiment === "pos" && (topic.sentiment ?? 0) <= 0.15) {
    return false;
  }
  if (filters.sentiment === "neg" && (topic.sentiment ?? 0) >= -0.15) {
    return false;
  }
  if (filters.sentiment === "controversial" && !isControversialTopic(topic)) {
    return false;
  }

  if (filters.minZ > 0) {
    const anomalyScore = topic.anomalyScore ?? Number.NEGATIVE_INFINITY;
    if (!Number.isFinite(anomalyScore) || anomalyScore < filters.minZ) {
      return false;
    }
  }

  if (filters.q) {
    const query = filters.q.toLowerCase();
    const haystack = [
      topic.nameKo,
      topic.nameEn,
      topic.summaryKo ?? "",
      topic.summaryEn ?? "",
      ...(topic.keywords ?? []),
      ...(topic.entities ?? []).map((entity) => entity.text),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) {
      return false;
    }
  }

  return true;
}

interface DashboardClientProps {
  initialRegions?: RegionsApiResponse;
  initialGlobalTopics?: GlobalTopicsApiResponse;
  scope?: DashboardScope;
}

export function DashboardClient({
  initialRegions,
  initialGlobalTopics,
  scope = "community",
}: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLanguage("ko");

  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [pinnedTopicIds, setPinnedTopicIds] = useState<number[]>([]);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString()), scope),
    [scope, searchParams],
  );

  const activeScope = filters.scope;

  const {
    data: regionsData,
    isLoading: isRegionsLoading,
    error: regionsError,
  } = useRegions(activeScope, {
    fallbackData: activeScope === scope ? initialRegions : undefined,
  });

  const {
    data: globalTopicsData,
    isLoading: isGlobalLoading,
    error: globalError,
  } = useGlobalTopics(30, activeScope, {
    fallbackData: activeScope === scope ? initialGlobalTopics : undefined,
  });

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const rawRegions = useMemo(() => {
    const regions = regionsData?.regions ?? [];
    return [...regions].sort((a, b) => {
      const leftIndex = MAIN_REGION_ORDER.indexOf(a.id as (typeof MAIN_REGION_ORDER)[number]);
      const rightIndex = MAIN_REGION_ORDER.indexOf(b.id as (typeof MAIN_REGION_ORDER)[number]);
      const normalizedLeft = leftIndex < 0 ? 99 : leftIndex;
      const normalizedRight = rightIndex < 0 ? 99 : rightIndex;

      if (normalizedLeft !== normalizedRight) {
        return normalizedLeft - normalizedRight;
      }
      return b.totalHeatScore - a.totalHeatScore;
    });
  }, [regionsData?.regions]);

  const maxRegionHeatScore = useMemo(
    () => Math.max(...rawRegions.map((region) => region.totalHeatScore), 1),
    [rawRegions],
  );

  const filteredRegions = useMemo(() => {
    return rawRegions
      .map((region) => {
        const filteredTopics = region.topTopics.filter((topic) => matchesTopicFilters(topic, filters, nowMs));
        const displayTopics = filteredTopics.slice(0, 12);
        const totalHeatScore = displayTopics.reduce((sum, topic) => sum + topic.heatScore, 0);
        const keywordCounts = new Map<string, number>();

        for (const topic of displayTopics) {
          for (const keyword of topic.keywords ?? []) {
            const key = keyword.trim();
            if (!key) {
              continue;
            }
            keywordCounts.set(key, (keywordCounts.get(key) ?? 0) + 1);
          }
        }

        const topKeywords = [...keywordCounts.entries()]
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .slice(0, 5)
          .map(([keyword]) => keyword);

        return {
          ...region,
          totalHeatScore: totalHeatScore || region.totalHeatScore,
          activeTopics: displayTopics.length,
          topKeywords: topKeywords.length > 0 ? topKeywords : region.topKeywords,
          topTopics: displayTopics,
        };
      })
      .filter((region) => region.topTopics.length > 0);
  }, [filters, nowMs, rawRegions]);

  const filteredGlobalTopics = useMemo(() => {
    const query = filters.q.toLowerCase();
    return (globalTopicsData?.globalTopics ?? []).filter((topic) => {
      if (filters.sentiment === "pos" && averageSentiment(topic) <= 0.15) {
        return false;
      }
      if (filters.sentiment === "neg" && averageSentiment(topic) >= -0.15) {
        return false;
      }
      if (filters.q) {
        const haystack = [topic.nameKo, topic.nameEn, topic.summaryKo ?? "", topic.summaryEn ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [filters.q, filters.sentiment, globalTopicsData?.globalTopics]);

  const topGlobalIssues = useMemo(() => filteredGlobalTopics.slice(0, 5), [filteredGlobalTopics]);

  const comparePool = useMemo(() => {
    const byId = new Map<number, Topic>();
    for (const region of rawRegions) {
      for (const topic of region.topTopics) {
        if (typeof topic.id === "number" && !byId.has(topic.id)) {
          byId.set(topic.id, topic);
        }
      }
    }
    return [...byId.values()];
  }, [rawRegions]);

  const validPinnedTopicIds = useMemo(
    () => pinnedTopicIds.filter((topicId) => comparePool.some((topic) => topic.id === topicId)),
    [comparePool, pinnedTopicIds],
  );
  const {
    items: watchedItems,
    alertCount,
    isWatched,
    toggleWatch,
    clearAlerts,
    requestBrowserNotification,
  } = useWatchlist(comparePool);

  const tickerItems = filteredRegions
    .flatMap((region) =>
      region.topTopics.slice(0, 1).map((topic) => {
        const cleaned = cleanupTopicName({
          id: topic.id,
          regionId: topic.regionId,
          nameKo: topic.nameKo,
          nameEn: topic.nameEn,
          keywords: topic.keywords,
          entities: topic.entities ?? null,
        });
        const badge = cleaned.isFallback ? ` [${t("dashboard.badge.nameRefining")}]` : "";
        return `${region.flagEmoji} ${region.nameKo}: "${cleaned.displayKo}" 🔥${Math.round(topic.heatScore)}${badge}`;
      }),
    )
    .slice(0, 10);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyHash = () => {
      const match = window.location.hash.match(/^#topic=(\d+)$/);
      if (!match) {
        setSelectedTopicId(null);
        return;
      }
      setSelectedTopicId(Number(match[1]));
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const openTopicSheet = (topicId: number) => {
    setSelectedTopicId(topicId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.hash = `topic=${topicId}`;
      window.history.replaceState(null, "", url.toString());
    }
  };

  const closeTopicSheet = () => {
    setSelectedTopicId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.hash = "";
      window.history.replaceState(null, "", url.toString());
    }
  };

  const togglePinnedTopic = (topicId: number) => {
    setPinnedTopicIds((previous) => {
      const normalized = previous.filter((id) => comparePool.some((topic) => topic.id === id));

      if (normalized.includes(topicId)) {
        return normalized.filter((id) => id !== topicId);
      }
      if (normalized.length >= 3) {
        return normalized;
      }
      return [...normalized, topicId];
    });
  };

  const updateFilters = (next: DashboardFilters) => {
    const queryString = buildQueryString(next);
    const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-10 pt-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3 py-2">
        <FilterBar value={filters} onChange={updateFilters} />
        <div className="flex items-center gap-2">
          <WatchBell
            items={watchedItems}
            alertCount={alertCount}
            onClearAlerts={clearAlerts}
            onRequestNotification={requestBrowserNotification}
            onTopicSelect={openTopicSheet}
          />
          <button
            type="button"
            aria-label={t("dashboard.action.openCompare")}
            onClick={() => setIsCompareOpen(true)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          >
            {t("dashboard.compareDrawer")} ({validPinnedTopicIds.length}/3)
          </button>
        </div>
      </div>

      {regionsError && (
        <EmptyState
          title={t("dashboard.loadError")}
          description={t("dashboard.loadErrorDesc")}
        />
      )}

      {!regionsError && isRegionsLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      )}

      {!regionsError && !isRegionsLoading && filteredRegions.length === 0 && (
        <EmptyState
          title={t("dashboard.noRegions")}
          description={t("dashboard.noRegionsDesc")}
        />
      )}

      {!regionsError && filteredRegions.length > 0 && (
        <>
          <section className="py-8">
            <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-card)]">
                <WorldHeatMap
                  regions={filteredRegions}
                  globalTopics={filteredGlobalTopics}
                  onTopicSelect={openTopicSheet}
                />
              </div>
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-card)]">
                {isGlobalLoading ? (
                  <LoadingSkeleton className="h-36" />
                ) : globalError ? (
                  <EmptyState
                    title={t("dashboard.empty.globalTopics")}
                    description={t("dashboard.error.globalRetry")}
                  />
                ) : (
                  <GlobalIssuePanel topics={topGlobalIssues} />
                )}
              </div>
            </div>
          </section>

          <div className="my-8 border-t border-white/5" />

          <section className="py-8">
            <div className="space-y-4">
              <LivePulseStrip items={tickerItems} />
              <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-card)]">
                  <PulseSignalBoard regions={filteredRegions} globalTopics={filteredGlobalTopics} />
                </div>
                <aside className="space-y-4 xl:max-h-[780px] xl:overflow-y-auto xl:pr-1">
                  {filteredRegions.map((region) => (
                    <RegionCard
                      key={region.id}
                      region={region}
                      maxRegionHeatScore={maxRegionHeatScore}
                      scope={activeScope}
                      onTopicSelect={openTopicSheet}
                      onToggleWatch={toggleWatch}
                      isTopicWatched={isWatched}
                    />
                  ))}
                </aside>
              </div>
            </div>
          </section>

          <div className="my-8 border-t border-white/5" />

          <section className="py-8">
            <details
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-card)]"
              open={advancedExpanded}
              onToggle={(event) => setAdvancedExpanded((event.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer select-none text-sm font-medium text-[var(--text-primary)]">
                {t("dashboard.section.advancedExpand")}
              </summary>
              {advancedExpanded ? (
                <div className="mt-4 space-y-4">
                  <PropagationStream
                    regions={filteredRegions}
                    globalTopics={filteredGlobalTopics}
                    onTopicSelect={openTopicSheet}
                  />
                  <PropagationMatrix scope={activeScope} />
                </div>
              ) : null}
            </details>
          </section>
        </>
      )}

      <TopicDetailSheet
        topicId={selectedTopicId}
        onClose={closeTopicSheet}
        isWatched={isWatched(selectedTopicId ?? undefined)}
        onToggleWatch={() => {
          const target = comparePool.find((topic) => topic.id === selectedTopicId);
          if (target) {
            toggleWatch(target);
          }
        }}
      />
      <CompareDrawer
        open={isCompareOpen}
        topics={comparePool}
        pinnedTopicIds={validPinnedTopicIds}
        onTogglePin={togglePinnedTopic}
        onClose={() => setIsCompareOpen(false)}
        onTopicSelect={openTopicSheet}
      />
    </main>
  );
}
