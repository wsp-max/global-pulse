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
import { useLanguage } from "@/lib/i18n/use-language";
import type { DashboardScope, GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

const WorldHeatMap = dynamic(() => import("./WorldHeatMap").then((mod) => mod.WorldHeatMap), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-[620px]" />,
});

const TopicDetailSheet = dynamic(() => import("./TopicDetailSheet").then((mod) => mod.TopicDetailSheet), {
  ssr: false,
});

interface DashboardClientProps {
  initialRegions?: RegionsApiResponse;
  initialGlobalTopics?: GlobalTopicsApiResponse;
  scope?: DashboardScope;
}

type DashboardPeriod = "24h" | "7d";

const MAIN_REGION_ORDER = ["us", "cn", "jp", "kr", "eu", "in", "br", "ru"] as const;

function parseScope(input: string | null, fallback: DashboardScope): DashboardScope {
  if (input === "news" || input === "mixed" || input === "community") {
    return input;
  }
  return fallback;
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

  const activeScope = parseScope(searchParams.get("scope"), scope);
  const period = parsePeriod(searchParams.get("period"));

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

  const rawRegions = useMemo(() => {
    const regions = regionsData?.regions ?? [];
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
  }, [regionsData?.regions]);

  const filteredRegions = useMemo(() => {
    return rawRegions
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
  }, [period, rawRegions]);

  const topGlobalIssues = useMemo(() => {
    return [...(globalTopicsData?.globalTopics ?? [])]
      .sort((left, right) => (right.totalHeatScore ?? 0) - (left.totalHeatScore ?? 0))
      .slice(0, 5);
  }, [globalTopicsData?.globalTopics]);

  const topGlobalTopicIds = useMemo(
    () => new Set(topGlobalIssues.flatMap((globalTopic) => globalTopic.topicIds ?? [])),
    [topGlobalIssues],
  );

  const hottestTopic = filteredRegions.find((region) => region.topTopics.length > 0)?.topTopics[0] ?? null;

  const applyQuery = (next: { period?: DashboardPeriod; scope?: DashboardScope }) => {
    const params = new URLSearchParams(searchParams.toString());

    const nextPeriod = next.period ?? period;
    const nextScope = next.scope ?? activeScope;

    params.set("period", nextPeriod);
    params.set("scope", nextScope);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <main className="page-shell">
      <section className="card-panel p-2">
        <div className="flex h-7 items-center gap-3 px-2 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            LIVE
          </span>

          {hottestTopic ? (
            <span className="truncate">
              가장 뜨거운 이슈: <span className="text-[var(--text-primary)]">{hottestTopic.nameKo || hottestTopic.nameEn}</span> · heat {Math.round(hottestTopic.heatScore)}
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

      <ScopeTabs value={activeScope} onChange={(nextScope) => applyQuery({ scope: nextScope })} />

      {regionsError ? <EmptyState title={t("dashboard.loadError")} description={t("dashboard.loadErrorDesc")} /> : null}

      {isRegionsLoading ? <LoadingSkeleton className="h-[720px]" /> : null}

      {!regionsError && !isRegionsLoading && filteredRegions.length === 0 ? (
        <EmptyState title={t("dashboard.noRegions")} description={t("dashboard.noRegionsDesc")} />
      ) : null}

      {!regionsError && filteredRegions.length > 0 ? (
        <>
          <section className="card-panel p-4">
            <WorldHeatMap
              regions={filteredRegions}
              globalTopics={globalTopicsData?.globalTopics ?? []}
              onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
            />
          </section>

          <section>
            {isGlobalLoading ? (
              <LoadingSkeleton className="h-44" />
            ) : globalError ? (
              <EmptyState title={t("dashboard.empty.globalTopics")} description={t("dashboard.error.globalRetry")} />
            ) : (
              <HotIssueList topics={topGlobalIssues} onTopicSelect={(topicId) => setSelectedTopicId(topicId)} />
            )}
          </section>

          <section>
            <RegionBoard
              regions={filteredRegions}
              topGlobalTopicIds={topGlobalTopicIds}
              onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
            />
          </section>
        </>
      ) : null}

      <TopicDetailSheet topicId={selectedTopicId} onClose={() => setSelectedTopicId(null)} />
    </main>
  );
}
