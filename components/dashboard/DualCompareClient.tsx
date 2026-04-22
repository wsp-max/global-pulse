"use client";

import { useMemo } from "react";
import { HotIssueList } from "@/components/dashboard/HotIssueList";
import { WorldHeatMap } from "@/components/dashboard/WorldHeatMap";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import type { GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

interface DualCompareClientProps {
  initialCommunityRegions?: RegionsApiResponse;
  initialNewsRegions?: RegionsApiResponse;
  initialCommunityGlobalTopics?: GlobalTopicsApiResponse;
  initialNewsGlobalTopics?: GlobalTopicsApiResponse;
}

export function DualCompareClient({
  initialCommunityRegions,
  initialNewsRegions,
  initialCommunityGlobalTopics,
  initialNewsGlobalTopics,
}: DualCompareClientProps) {
  const { data: communityRegionsData } = useRegions("community", {
    fallbackData: initialCommunityRegions,
  });
  const { data: newsRegionsData } = useRegions("news", {
    fallbackData: initialNewsRegions,
  });

  const { data: communityGlobalData } = useGlobalTopics(30, "community", {
    fallbackData: initialCommunityGlobalTopics,
  });
  const { data: newsGlobalData } = useGlobalTopics(30, "news", {
    fallbackData: initialNewsGlobalTopics,
  });

  const communityRegions = useMemo(() => {
    return [...(communityRegionsData?.regions ?? [])].sort((a, b) => b.totalHeatScore - a.totalHeatScore);
  }, [communityRegionsData?.regions]);

  const newsRegions = useMemo(() => {
    return [...(newsRegionsData?.regions ?? [])].sort((a, b) => b.totalHeatScore - a.totalHeatScore);
  }, [newsRegionsData?.regions]);

  return (
    <main className="page-shell">
      <section>
        <h1 className="section-title">COMMUNITY VS NEWS</h1>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="card-panel p-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            community
          </div>
          <WorldHeatMap
            regions={communityRegions}
            globalTopics={communityGlobalData?.globalTopics ?? []}
            comparisonGlobalTopics={newsGlobalData?.globalTopics ?? []}
            comparisonScope="news"
            variant="community"
            compact
          />
          <div className="mt-4">
            <HotIssueList
              topics={communityGlobalData?.globalTopics ?? []}
              scope="community"
              comparisonTopics={newsGlobalData?.globalTopics ?? []}
              comparisonScope="news"
            />
          </div>
        </article>

        <article className="card-panel p-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            news
          </div>
          <WorldHeatMap
            regions={newsRegions}
            globalTopics={newsGlobalData?.globalTopics ?? []}
            comparisonGlobalTopics={communityGlobalData?.globalTopics ?? []}
            comparisonScope="community"
            variant="news"
            compact
          />
          <div className="mt-4">
            <HotIssueList
              topics={newsGlobalData?.globalTopics ?? []}
              scope="news"
              comparisonTopics={communityGlobalData?.globalTopics ?? []}
              comparisonScope="community"
            />
          </div>
        </article>
      </section>
    </main>
  );
}
