"use client";

import {
  GlobalIssuePanel,
  HotTopicTicker,
  LivePulseIndicator,
  RegionCard,
  WorldHeatMap,
} from "@/components/dashboard";
import { Header } from "@/components/layout/Header";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";

export default function HomePage() {
  const { data: regionsData, isLoading: isRegionsLoading } = useRegions();
  const { data: globalTopicsData } = useGlobalTopics(5);

  const regions = regionsData?.regions ?? [];
  const sortedRegions = [...regions].sort((a, b) => b.totalHeatScore - a.totalHeatScore);

  const tickerItems = sortedRegions
    .flatMap((region) =>
      region.topTopics.slice(0, 1).map((topic) => {
        return `${region.flagEmoji} ${region.nameKo}: "${topic.nameKo}" 🔥${Math.round(topic.heatScore)}`;
      }),
    )
    .slice(0, 10);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-6 lg:px-6">
        <HotTopicTicker items={tickerItems} />

        <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-card)]">
            <WorldHeatMap regions={sortedRegions} />
            <div className="mt-4">
              <LivePulseIndicator />
            </div>
          </div>

          <div className="space-y-4">
            {isRegionsLoading && (
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
                리전 데이터 로딩 중...
              </div>
            )}
            {sortedRegions.map((region) => (
              <RegionCard key={region.id} region={region} />
            ))}
          </div>
        </section>

        <GlobalIssuePanel topics={globalTopicsData?.globalTopics ?? []} />
      </main>
    </div>
  );
}
