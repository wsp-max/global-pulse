"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GlobalIssuePanel } from "@/components/dashboard/GlobalIssuePanel";
import { RegionExplorer } from "@/components/dashboard/RegionExplorer";
import { RegionRiseList } from "@/components/dashboard/RegionRiseList";
import { ScopeTabs } from "@/components/dashboard/ScopeTabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import type { DashboardScope } from "@/lib/types/api";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

const TopicDetailSheet = dynamic(() => import("@/components/dashboard/TopicDetailSheet").then((mod) => mod.TopicDetailSheet), {
  ssr: false,
});

type DashboardPeriod = "24h" | "7d";
type GlobalIssuesView = "global" | "regions";

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

function parseView(input: string | null): GlobalIssuesView {
  return input === "regions" ? "regions" : "global";
}

function applyPeriodFilter(period: DashboardPeriod, periodEnd: string): boolean {
  if (period === "7d") {
    return true;
  }

  const endMs = new Date(periodEnd).getTime();
  if (!Number.isFinite(endMs)) {
    return true;
  }

  return endMs >= Date.now() - 24 * 60 * 60 * 1000;
}

export default function GlobalIssuesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const scope = parseScope(searchParams.get("scope"), "community");
  const period = parsePeriod(searchParams.get("period"));
  const view = parseView(searchParams.get("view"));

  const { data: globalData, isLoading: globalLoading, error: globalError } = useGlobalTopics(20, scope);
  const { data: regionsData, isLoading: regionsLoading, error: regionsError } = useRegions(scope);

  const filteredRegions = useMemo(() => {
    const regions = regionsData?.regions ?? [];
    return [...regions]
      .sort((left, right) => {
        const leftIndex = MAIN_REGION_ORDER.indexOf(left.id as (typeof MAIN_REGION_ORDER)[number]);
        const rightIndex = MAIN_REGION_ORDER.indexOf(right.id as (typeof MAIN_REGION_ORDER)[number]);
        const lp = leftIndex < 0 ? 99 : leftIndex;
        const rp = rightIndex < 0 ? 99 : rightIndex;
        if (lp !== rp) {
          return lp - rp;
        }
        return (right.totalHeatScore ?? 0) - (left.totalHeatScore ?? 0);
      })
      .map((region) => {
        const topTopics = region.topTopics.filter((topic) => applyPeriodFilter(period, topic.periodEnd));
        const totalHeatScore = topTopics.reduce((sum, topic) => sum + (topic.heatScore ?? 0), 0);
        return {
          ...region,
          topTopics,
          totalHeatScore: topTopics.length > 0 ? totalHeatScore : region.totalHeatScore,
          activeTopics: topTopics.length,
        };
      })
      .filter((region) => region.topTopics.length > 0);
  }, [period, regionsData?.regions]);

  const topRegionRows = useMemo(
    () =>
      filteredRegions
        .map((region) => ({
          regionId: region.id,
          regionName: region.nameKo,
          flagEmoji: region.flagEmoji,
          topTopicName: region.topTopics[0]
            ? getDisplayTopicName({
                id: region.topTopics[0].id,
                regionId: region.topTopics[0].regionId,
                nameKo: region.topTopics[0].nameKo,
                nameEn: region.topTopics[0].nameEn,
                summaryKo: region.topTopics[0].summaryKo,
                summaryEn: region.topTopics[0].summaryEn,
                sampleTitles: region.topTopics[0].sampleTitles,
                keywords: region.topTopics[0].keywords,
                entities: region.topTopics[0].entities ?? [],
              })
            : "토픽 데이터 없음",
          heatScore: region.topTopics[0]?.heatScore ?? 0,
        }))
        .sort((left, right) => right.heatScore - left.heatScore)
        .slice(0, 10),
    [filteredRegions],
  );

  const topGlobalTopicIds = useMemo(
    () => new Set((globalData?.globalTopics ?? []).flatMap((topic) => topic.topicIds ?? [])),
    [globalData?.globalTopics],
  );

  const applyQuery = (next: Partial<Record<"view" | "scope" | "period", string>>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next.view ?? view);
    params.set("scope", next.scope ?? scope);
    params.set("period", next.period ?? period);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const isLoading = view === "global" ? globalLoading || regionsLoading : regionsLoading;
  const hasError = view === "global" ? globalError || regionsError : regionsError;

  return (
    <main className="page-shell">
      <section className="card-panel p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="section-title mt-0">GLOBAL ISSUES</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              짧은 레이블 대신 의미형 이슈명과 요약을 기준으로 글로벌 흐름과 지역별 이슈를 탐색합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["global", "regions"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => applyQuery({ view: item })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  view === item
                    ? "border-[var(--border-strong)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                    : "border-[var(--border-default)] text-[var(--text-secondary)]"
                }`}
              >
                {item === "global" ? "Global Overview" : "Region Explorer"}
              </button>
            ))}

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

      <ScopeTabs value={scope} onChange={(nextScope) => applyQuery({ scope: nextScope })} />

      {isLoading ? <LoadingSkeleton className={view === "regions" ? "h-[640px]" : "h-24"} /> : null}

      {hasError ? (
        <EmptyState
          title={view === "regions" ? "지역 이슈를 불러오지 못했습니다." : "글로벌 이슈를 불러오지 못했습니다."}
          description="잠시 후 다시 시도해 주세요."
          className="mb-4"
        />
      ) : null}

      {!isLoading && !hasError && view === "global" ? (
        <section className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-7">
            <GlobalIssuePanel
              topics={globalData?.globalTopics ?? []}
              maxItems={20}
              onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
            />
          </div>
          <div className="card-panel p-5 md:col-span-5">
            <RegionRiseList items={topRegionRows} />
          </div>
        </section>
      ) : null}

      {!isLoading && !hasError && view === "regions" ? (
        filteredRegions.length > 0 ? (
          <RegionExplorer
            regions={filteredRegions}
            topGlobalTopicIds={topGlobalTopicIds}
            onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
          />
        ) : (
          <EmptyState
            title="표시할 지역 이슈가 없습니다."
            description="선택한 scope와 기간에 해당하는 지역별 토픽이 아직 집계되지 않았습니다."
          />
        )
      ) : null}

      <TopicDetailSheet topicId={selectedTopicId} onClose={() => setSelectedTopicId(null)} />
    </main>
  );
}
