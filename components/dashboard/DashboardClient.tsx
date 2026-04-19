"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GlobalIssuePanel,
  HotTopicTicker,
  LivePulseIndicator,
  PropagationStream,
  PulseSignalBoard,
  RegionCard,
  TopicDetailSheet,
  WorldHeatMap,
} from "@/components/dashboard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import type { DashboardScope, GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";
import { cleanupTopicName } from "@/lib/utils/topic-name";

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
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const {
    data: regionsData,
    isLoading: isRegionsLoading,
    error: regionsError,
  } = useRegions(scope, {
    fallbackData: initialRegions,
  });

  const {
    data: globalTopicsData,
    isLoading: isGlobalLoading,
    error: globalError,
  } = useGlobalTopics(30, scope, {
    fallbackData: initialGlobalTopics,
  });

  const sortedRegions = useMemo(() => {
    const regions = regionsData?.regions ?? [];
    return [...regions].sort((a, b) => b.totalHeatScore - a.totalHeatScore);
  }, [regionsData?.regions]);

  const tickerItems = sortedRegions
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
        const badge = cleaned.isFallback ? " [이름 정제 중]" : "";
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
          description="수집기와 분석기가 실행되면 데이터가 자동 반영됩니다."
        />
      )}

      {!regionsError && sortedRegions.length > 0 && (
        <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 shadow-[var(--shadow-card)] sm:p-4 md:flex md:flex-col">
            <WorldHeatMap
              regions={sortedRegions}
              globalTopics={globalTopicsData?.globalTopics ?? []}
              onTopicSelect={openTopicSheet}
            />
            <div className="mt-4">
              <LivePulseIndicator />
            </div>
            <div className="mt-4 min-h-[220px] flex-1 md:min-h-[260px]">
              <PulseSignalBoard regions={sortedRegions} globalTopics={globalTopicsData?.globalTopics ?? []} />
            </div>
          </div>

          <div className="space-y-4">
            {sortedRegions.map((region) => (
              <RegionCard key={region.id} region={region} scope={scope} onTopicSelect={openTopicSheet} />
            ))}
          </div>
        </section>
      )}

      {!regionsError && sortedRegions.length > 0 && (
        <PropagationStream
          regions={sortedRegions}
          globalTopics={globalTopicsData?.globalTopics ?? []}
          onTopicSelect={openTopicSheet}
        />
      )}

      {isGlobalLoading && <LoadingSkeleton className="h-28" />}
      {globalError && (
        <EmptyState
          title="글로벌 이슈를 불러오지 못했습니다."
          description="잠시 후 자동으로 다시 시도합니다."
        />
      )}
      {!isGlobalLoading && !globalError && <GlobalIssuePanel topics={globalTopicsData?.globalTopics ?? []} />}

      <TopicDetailSheet topicId={selectedTopicId} onClose={closeTopicSheet} />
    </main>
  );
}
