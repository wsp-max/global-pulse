"use client";

import { GlobalIssuePanel } from "@/components/dashboard/GlobalIssuePanel";
import { RegionRiseList } from "@/components/dashboard/RegionRiseList";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";

export default function GlobalIssuesPage() {
  const { data, isLoading, error } = useGlobalTopics(20);
  const { data: regionsData, isLoading: regionsLoading } = useRegions("community");

  const topRegionRows =
    regionsData?.regions
      .map((region) => ({
        regionId: region.id,
        regionName: region.nameKo,
        flagEmoji: region.flagEmoji,
        topTopicName: region.topTopics[0]?.nameKo || region.topTopics[0]?.nameEn || "토픽 데이터 없음",
        heatScore: region.topTopics[0]?.heatScore ?? 0,
      }))
      .sort((left, right) => right.heatScore - left.heatScore)
      .slice(0, 10) ?? [];

  return (
    <main className="page-shell">
      <h1 className="section-title mt-0">GLOBAL ISSUES</h1>

      {isLoading ? <LoadingSkeleton className="h-24" /> : null}

      {error ? (
        <EmptyState
          title="글로벌 이슈를 불러오지 못했습니다."
          description="잠시 후 다시 시도해 주세요."
          className="mb-4"
        />
      ) : null}

      {!isLoading && !error ? (
        <section className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-7">
            <GlobalIssuePanel topics={data?.globalTopics ?? []} maxItems={20} />
          </div>
          <div className="card-panel p-5 md:col-span-5">
            {regionsLoading ? <LoadingSkeleton className="h-28" lines={5} /> : <RegionRiseList items={topRegionRows} />}
          </div>
        </section>
      ) : null}
    </main>
  );
}
