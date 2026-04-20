"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { GlobalTopic } from "@global-pulse/shared";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useRegions } from "@/lib/hooks/useRegions";
import type { DashboardScope, GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

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
  scope: DashboardScope;
  initialRegions?: RegionsApiResponse;
  initialGlobalTopics?: GlobalTopicsApiResponse;
}

function parseScope(value: string): DashboardScope {
  if (value === "news" || value === "mixed") {
    return value;
  }
  return "community";
}

export function PropagationPageClient({
  scope,
  initialRegions,
  initialGlobalTopics,
}: PropagationPageClientProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const { data: regionsData, isLoading: regionsLoading } = useRegions(scope, {
    fallbackData: initialRegions,
  });
  const { data: globalTopicsData, isLoading: globalLoading } = useGlobalTopics(30, scope, {
    fallbackData: initialGlobalTopics,
  });

  const regions = useMemo(() => regionsData?.regions ?? [], [regionsData?.regions]);
  const globalTopics = useMemo(() => globalTopicsData?.globalTopics ?? [], [globalTopicsData?.globalTopics]);

  return (
    <main className="page-shell">
      <section>
        <h1 className="section-title">PROPAGATION</h1>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)]">
          scope: {parseScope(scope)}
        </div>
      </section>

      <section className="card-panel p-5">
        {regionsLoading || globalLoading ? (
          <LoadingSkeleton className="h-[280px]" />
        ) : (
          <PulseSignalBoard regions={regions} globalTopics={globalTopics} />
        )}
      </section>

      <div className="border-t border-white/5" />

      <section className="card-panel p-5">
        {regionsLoading || globalLoading ? (
          <LoadingSkeleton className="h-[260px]" />
        ) : (
          <PropagationStream
            regions={regions}
            globalTopics={globalTopics as GlobalTopic[]}
            onTopicSelect={(topicId) => setSelectedTopicId(topicId)}
          />
        )}
      </section>

      <div className="border-t border-white/5" />

      <section className="card-panel p-5">
        <PropagationMatrix scope={scope} />
      </section>

      <TopicDetailSheet topicId={selectedTopicId} onClose={() => setSelectedTopicId(null)} />
    </main>
  );
}
