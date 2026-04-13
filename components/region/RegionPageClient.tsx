"use client";

import { useMemo, useState } from "react";
import type { Topic } from "@global-pulse/shared";
import { useTimeline } from "@/lib/hooks/useTimeline";
import { useTopics } from "@/lib/hooks/useTopics";
import { RegionHeader } from "./RegionHeader";
import { SentimentGauge } from "./SentimentGauge";
import { SourceBreakdown } from "./SourceBreakdown";
import { TopicList } from "./TopicList";
import { TrendChart } from "./TrendChart";

interface RegionPageClientProps {
  regionId: string;
}

export function RegionPageClient({ regionId }: RegionPageClientProps) {
  const { data, isLoading } = useTopics(regionId, 20);
  const topics = useMemo(() => data?.topics ?? [], [data?.topics]);

  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>(undefined);
  const activeTopicId = selectedTopicId ?? topics[0]?.id;

  const selectedTopic = useMemo(() => {
    if (activeTopicId) {
      const found = topics.find((topic) => topic.id === activeTopicId);
      if (found) return found;
    }
    return topics[0];
  }, [activeTopicId, topics]);

  const { data: timelineData } = useTimeline(selectedTopic?.nameEn, regionId, 24);
  const timeline = timelineData?.timeline ?? [];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6">
      <RegionHeader regionId={regionId} snapshot={data?.snapshot} />
      <TrendChart points={timeline} />

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Top Topics</h2>
          {isLoading ? (
            <div className="text-sm text-[var(--text-secondary)]">토픽 로딩 중...</div>
          ) : (
            <TopicList
              topics={topics}
              selectedTopicId={selectedTopic?.id}
              onSelect={(topic: Topic) => setSelectedTopicId(topic.id)}
            />
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <h2 className="text-sm font-semibold">{selectedTopic?.nameKo ?? "Topic Detail"}</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {selectedTopic?.summaryKo ?? "요약 데이터가 아직 없습니다."}
          </p>
          <SentimentGauge value={selectedTopic?.sentiment ?? 0} />
          <SourceBreakdown sourceIds={selectedTopic?.sourceIds ?? []} />
          <div className="text-xs text-[var(--text-tertiary)]">
            게시글 {selectedTopic?.postCount ?? 0} · 댓글 {selectedTopic?.totalComments ?? 0}
          </div>
        </div>
      </section>
    </main>
  );
}
