"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { WorldHeatMap } from "@/components/dashboard/WorldHeatMap";
import { fetcher } from "@/lib/api";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import type {
  GlobalTopicsApiResponse,
  IssueOverlapsApiResponse,
  RegionsApiResponse,
} from "@/lib/types/api";

interface DualCompareClientProps {
  initialCommunityRegions?: RegionsApiResponse;
  initialNewsRegions?: RegionsApiResponse;
  initialCommunityGlobalTopics?: GlobalTopicsApiResponse;
  initialNewsGlobalTopics?: GlobalTopicsApiResponse;
  initialOverlaps?: IssueOverlapsApiResponse;
}

function toLagLabel(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return "-";
  }

  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const sign = minutes > 0 ? "+" : "-";

  if (hours > 0) {
    return `${sign}${hours}h ${mins}m`;
  }
  return `${sign}${mins}m`;
}

export function DualCompareClient({
  initialCommunityRegions,
  initialNewsRegions,
  initialCommunityGlobalTopics,
  initialNewsGlobalTopics,
  initialOverlaps,
}: DualCompareClientProps) {
  const { data: communityRegionsData } = useRegions("community", {
    fallbackData: initialCommunityRegions,
  });
  const { data: newsRegionsData } = useRegions("news", {
    fallbackData: initialNewsRegions,
  });

  const { data: communityGlobalData } = useGlobalTopics(20, "community", {
    fallbackData: initialCommunityGlobalTopics,
  });
  const { data: newsGlobalData } = useGlobalTopics(20, "news", {
    fallbackData: initialNewsGlobalTopics,
  });

  const { data: overlapsData } = useSWR<IssueOverlapsApiResponse>("/issue-overlaps?limit=20&minTier=2", fetcher, {
    refreshInterval: 60_000,
    fallbackData: initialOverlaps,
    revalidateOnMount: !initialOverlaps,
  });

  const communityRegions = useMemo(() => {
    return [...(communityRegionsData?.regions ?? [])].sort((a, b) => b.totalHeatScore - a.totalHeatScore);
  }, [communityRegionsData?.regions]);

  const newsRegions = useMemo(() => {
    return [...(newsRegionsData?.regions ?? [])].sort((a, b) => b.totalHeatScore - a.totalHeatScore);
  }, [newsRegionsData?.regions]);

  const overlaps = overlapsData?.overlaps ?? [];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-6 lg:px-6">
      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <p className="font-display text-sm tracking-[0.16em] text-[var(--text-accent)]">COMMUNITY</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Community + SNS discourse map.</p>
          <div className="mt-3">
            <WorldHeatMap regions={communityRegions} globalTopics={communityGlobalData?.globalTopics ?? []} variant="community" />
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <p className="font-display text-sm tracking-[0.16em] text-amber-300">NEWS &amp; PORTALS</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Wire services, broadcasters, and portal rankings.</p>
          <div className="mt-3">
            <WorldHeatMap regions={newsRegions} globalTopics={newsGlobalData?.globalTopics ?? []} variant="news" />
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-sm tracking-[0.16em] text-[var(--text-accent)]">OVERLAP SIGNALS</p>
          <span className="text-xs text-[var(--text-secondary)]">community rank | news rank | lag | leader</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              <tr>
                <th className="px-2 py-2">Issue</th>
                <th className="px-2 py-2">Community Rank</th>
                <th className="px-2 py-2">News Rank</th>
                <th className="px-2 py-2">Lag</th>
                <th className="px-2 py-2">Leader</th>
              </tr>
            </thead>
            <tbody>
              {overlaps.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-[var(--text-secondary)]" colSpan={5}>
                    No overlap rows yet. Enable news pipeline and run global analysis.
                  </td>
                </tr>
              ) : (
                overlaps.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border-default)]">
                    <td className="px-2 py-2">
                      <p className="text-[var(--text-primary)]">{row.communityTopic.nameKo || row.communityTopic.nameEn}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{row.canonicalKey ?? "-"}</p>
                    </td>
                    <td className="px-2 py-2">{row.communityTopic.rank ?? "-"}</td>
                    <td className="px-2 py-2">{row.newsTopic.rank ?? "-"}</td>
                    <td className="px-2 py-2">{toLagLabel(row.lagMinutes)}</td>
                    <td className="px-2 py-2">
                      <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-xs">
                        {row.leader ?? "-"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
