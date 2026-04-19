"use client";

import { useMemo } from "react";
import {
  GlobalIssuePanel,
  HotTopicTicker,
  LivePulseIndicator,
  PropagationStream,
  PulseSignalBoard,
  RegionCard,
  WorldHeatMap,
} from "@/components/dashboard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import type { GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

interface DashboardClientProps {
  initialRegions?: RegionsApiResponse;
  initialGlobalTopics?: GlobalTopicsApiResponse;
}

export function DashboardClient({ initialRegions, initialGlobalTopics }: DashboardClientProps) {
  const {
    data: regionsData,
    isLoading: isRegionsLoading,
    error: regionsError,
  } = useRegions({
    fallbackData: initialRegions,
  });
  const {
    data: globalTopicsData,
    isLoading: isGlobalLoading,
    error: globalError,
  } = useGlobalTopics(20, {
    fallbackData: initialGlobalTopics,
  });

  const sortedRegions = useMemo(() => {
    const regions = regionsData?.regions ?? [];
    return [...regions].sort((a, b) => b.totalHeatScore - a.totalHeatScore);
  }, [regionsData?.regions]);

  const tickerItems = sortedRegions
    .flatMap((region) =>
      region.topTopics.slice(0, 1).map((topic) => {
        return `${region.flagEmoji} ${region.nameKo}: "${topic.nameKo}" 🔥${Math.round(topic.heatScore)}`;
      }),
    )
    .slice(0, 10);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-6 lg:px-6">
      <HotTopicTicker items={tickerItems} />

      {regionsError && (
        <EmptyState
          title="대시보드 데이터를 불러오지 못했습니다."
          description="잠시 후 자동으로 다시 시도합니다. 문제가 계속되면 서버 상태를 확인해 주세요."
        />
      )}

      {!regionsError && isRegionsLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      )}

      {!regionsError && !isRegionsLoading && sortedRegions.length === 0 && (
        <EmptyState
          title="표시할 리전 데이터가 없습니다."
          description="수집기와 분석기 실행 이후 데이터가 자동 반영됩니다."
        />
      )}

      {!regionsError && sortedRegions.length > 0 && (
        <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 shadow-[var(--shadow-card)] sm:p-4 md:flex md:flex-col">
            <WorldHeatMap regions={sortedRegions} globalTopics={globalTopicsData?.globalTopics ?? []} />
            <div className="mt-4">
              <LivePulseIndicator />
            </div>
            <div className="mt-4 min-h-[220px] flex-1 md:min-h-[260px]">
              <PulseSignalBoard regions={sortedRegions} globalTopics={globalTopicsData?.globalTopics ?? []} />
            </div>
          </div>

          <div className="space-y-4">
            {sortedRegions.map((region) => (
              <RegionCard key={region.id} region={region} />
            ))}
          </div>
        </section>
      )}

      {!regionsError && sortedRegions.length > 0 && (
        <PropagationStream regions={sortedRegions} globalTopics={globalTopicsData?.globalTopics ?? []} />
      )}

      {isGlobalLoading && <LoadingSkeleton className="h-28" />}
      {globalError && (
        <EmptyState
          title="글로벌 이슈를 불러오지 못했습니다."
          description="잠시 후 자동으로 다시 시도합니다."
        />
      )}
      {!isGlobalLoading && !globalError && <GlobalIssuePanel topics={globalTopicsData?.globalTopics ?? []} />}
    </main>
  );
}
