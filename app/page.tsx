"use client";

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

export default function HomePage() {
  const { data: regionsData, isLoading: isRegionsLoading, error: regionsError } = useRegions();
  const {
    data: globalTopicsData,
    isLoading: isGlobalLoading,
    error: globalError,
  } = useGlobalTopics(5);

  const regions = regionsData?.regions ?? [];
  const sortedRegions = [...regions].sort((a, b) => b.totalHeatScore - a.totalHeatScore);

  const tickerItems = sortedRegions
    .flatMap((region) =>
      region.topTopics.slice(0, 1).map((topic) => {
        return `${region.flagEmoji} ${region.nameKo}: "${topic.nameKo}" \uD83D\uDD25${Math.round(topic.heatScore)}`;
      }),
    )
    .slice(0, 10);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-6 lg:px-6">
      <HotTopicTicker items={tickerItems} />

      {regionsError && (
        <EmptyState
          title="\uB300\uC2DC\uBCF4\uB4DC \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."
          description="\uC7A0\uC2DC \uD6C4 \uC790\uB3D9\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD569\uB2C8\uB2E4. \uBB38\uC81C\uAC00 \uACC4\uC18D\uB418\uBA74 \uC11C\uBC84 \uC0C1\uD0DC\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694."
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
          title="\uD45C\uC2DC\uD560 \uB9AC\uC804 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."
          description="\uC218\uC9D1\uAE30\uC640 \uBD84\uC11D\uAE30 \uC2E4\uD589 \uC774\uD6C4 \uB370\uC774\uD130\uAC00 \uC790\uB3D9 \uBC18\uC601\uB429\uB2C8\uB2E4."
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
          title="\uAE00\uB85C\uBC8C \uC774\uC288\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."
          description="\uC7A0\uC2DC \uD6C4 \uC790\uB3D9\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD569\uB2C8\uB2E4."
        />
      )}
      {!isGlobalLoading && !globalError && <GlobalIssuePanel topics={globalTopicsData?.globalTopics ?? []} />}
    </main>
  );
}
