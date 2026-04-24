"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { GlobalTopic } from "@global-pulse/shared";
import { ScopeTabs } from "@/components/dashboard/ScopeTabs";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import type { GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";
import {
  countQualifiedRoutes,
  getScopeLongLabel,
  prepareQualifiedGlobalTopics,
} from "@/lib/utils/signal-quality";

const PulseSignalBoard = dynamic(() => import("./PulseSignalBoard").then((mod) => mod.PulseSignalBoard), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-[320px]" />,
});

const PropagationStream = dynamic(() => import("./PropagationStream").then((mod) => mod.PropagationStream), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-[260px]" />,
});

const PropagationMatrix = dynamic(() => import("./PropagationMatrix").then((mod) => mod.PropagationMatrix), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-[220px]" />,
});

const TopicDetailSheet = dynamic(() => import("./TopicDetailSheet").then((mod) => mod.TopicDetailSheet), {
  ssr: false,
});

interface PropagationPageClientProps {
  scope: "community" | "news";
  initialCommunityRegions?: RegionsApiResponse;
  initialNewsRegions?: RegionsApiResponse;
  initialCommunityGlobalTopics?: GlobalTopicsApiResponse;
  initialNewsGlobalTopics?: GlobalTopicsApiResponse;
}

function parseScope(value: string | null, fallback: "community" | "news"): "community" | "news" {
  if (value === "news") {
    return "news";
  }
  if (value === "community") {
    return "community";
  }
  return fallback;
}

export function PropagationPageClient({
  scope,
  initialCommunityRegions,
  initialNewsRegions,
  initialCommunityGlobalTopics,
  initialNewsGlobalTopics,
}: PropagationPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const activeScope = parseScope(searchParams.get("scope"), scope);
  const secondaryScope = activeScope === "community" ? "news" : "community";

  const communityRegions = useRegions("community", {
    fallbackData: initialCommunityRegions,
  });
  const newsRegions = useRegions("news", {
    fallbackData: initialNewsRegions,
  });
  const communityGlobalTopics = useGlobalTopics(60, "community", {
    fallbackData: initialCommunityGlobalTopics,
  });
  const newsGlobalTopics = useGlobalTopics(30, "news", {
    fallbackData: initialNewsGlobalTopics,
  });

  const primaryRegionsData = activeScope === "community" ? communityRegions.data : newsRegions.data;
  const secondaryRegionsData = activeScope === "community" ? newsRegions.data : communityRegions.data;
  const primaryGlobalData = activeScope === "community" ? communityGlobalTopics.data : newsGlobalTopics.data;
  const secondaryGlobalData = activeScope === "community" ? newsGlobalTopics.data : communityGlobalTopics.data;
  const isLoading = activeScope === "community"
    ? communityRegions.isLoading || communityGlobalTopics.isLoading
    : newsRegions.isLoading || newsGlobalTopics.isLoading;

  const regions = useMemo(() => primaryRegionsData?.regions ?? [], [primaryRegionsData?.regions]);
  const secondaryRegions = useMemo(() => secondaryRegionsData?.regions ?? [], [secondaryRegionsData?.regions]);
  const globalTopics = useMemo(() => primaryGlobalData?.globalTopics ?? [], [primaryGlobalData?.globalTopics]);
  const secondaryGlobalTopics = useMemo(() => secondaryGlobalData?.globalTopics ?? [], [secondaryGlobalData?.globalTopics]);

  const qualifiedPrimaryTopics = useMemo(
    () => prepareQualifiedGlobalTopics(globalTopics, activeScope),
    [globalTopics, activeScope],
  );
  const qualifiedSecondaryTopics = useMemo(
    () => prepareQualifiedGlobalTopics(secondaryGlobalTopics, secondaryScope),
    [secondaryGlobalTopics, secondaryScope],
  );

  const primaryRouteCount = useMemo(() => countQualifiedRoutes(globalTopics, activeScope), [globalTopics, activeScope]);
  const secondaryRouteCount = useMemo(
    () => countQualifiedRoutes(secondaryGlobalTopics, secondaryScope),
    [secondaryGlobalTopics, secondaryScope],
  );

  const applyScope = (nextScope: "community" | "news") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("scope", nextScope);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <main className="page-shell">
      <section>
        <h1 className="section-title">확산 분석</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">선택 source의 확산 흐름을 보고, 반대 source가 같은 배치에서 이를 확인하는지 함께 봅니다.</p>
      </section>

      <ScopeTabs
        value={activeScope}
        onChange={(nextScope) => applyScope(nextScope === "news" ? "news" : "community")}
      />

      <section className="grid gap-3 md:grid-cols-4">
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">primary</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{getScopeLongLabel(activeScope)}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">활성 지역 {regions.length} · 확산 이슈 {qualifiedPrimaryTopics.length}</p>
        </article>
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">routes</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{primaryRouteCount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">선택 source 확인 경로 수</p>
        </article>
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">secondary</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{getScopeLongLabel(secondaryScope)}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">활성 지역 {secondaryRegions.length} · 확산 이슈 {qualifiedSecondaryTopics.length}</p>
        </article>
        <article className="card-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">cross-check</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{secondaryRouteCount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">반대 source 확인 경로 수</p>
        </article>
      </section>

      <section className="card-panel p-5">
        {isLoading ? <LoadingSkeleton className="h-[280px]" /> : <PulseSignalBoard regions={regions} globalTopics={qualifiedPrimaryTopics} />}
      </section>

      <div className="border-t border-white/5" />

      <section className="card-panel p-5">
        {isLoading ? (
          <LoadingSkeleton className="h-[260px]" />
        ) : (
          <PropagationStream
            regions={regions}
            globalTopics={qualifiedPrimaryTopics as GlobalTopic[]}
            onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
          />
        )}
      </section>

      <div className="border-t border-white/5" />

      <section className="card-panel p-5">
        <PropagationMatrix scope={activeScope} />
      </section>

      <TopicDetailSheet topicId={selectedTopicId} onClose={() => setSelectedTopicId(null)} />
    </main>
  );
}
