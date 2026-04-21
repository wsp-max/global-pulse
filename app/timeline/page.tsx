"use client";

import { useMemo, useState } from "react";
import type { GlobalTopic } from "@global-pulse/shared";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { TopicTimeline } from "@/components/topic/TopicTimeline";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useTimeline } from "@/lib/hooks/useTimeline";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

export default function TimelinePage() {
  const { data: globalData, isLoading: globalLoading, error: globalError } = useGlobalTopics(50);
  const globalTopics = useMemo(() => globalData?.globalTopics ?? [], [globalData?.globalTopics]);

  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [hours, setHours] = useState<number>(72);
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const topicOptions = useMemo(
    () =>
      globalTopics.filter(
        (topic): topic is GlobalTopic & { id: number } => typeof topic.id === "number",
      ),
    [globalTopics],
  );

  const activeTopicId = selectedTopicId || (topicOptions[0] ? String(topicOptions[0].id) : "");
  const selectedTopic = useMemo(
    () => globalTopics.find((topic) => String(topic.id) === activeTopicId),
    [activeTopicId, globalTopics],
  );

  const timelineQuery = selectedTopic ? selectedTopic.nameEn || selectedTopic.nameKo : undefined;
  const regionArg = regionFilter === "all" ? undefined : regionFilter;
  const { data: timelineData, isLoading: timelineLoading, error: timelineError } = useTimeline(
    timelineQuery,
    regionArg,
    hours,
  );

  const selectableRegions = useMemo(() => {
    const all = new Set<string>();
    for (const topic of globalTopics) {
      for (const region of topic.regions ?? []) {
        all.add(region);
      }
    }
    return [...all].sort();
  }, [globalTopics]);

  return (
    <main className="page-shell">
      <section>
        <h1 className="section-title">TIMELINE</h1>
        <p className="card-sub mt-2">글로벌 이슈가 리전별로 어떻게 확산되는지 시간순으로 확인합니다.</p>
      </section>

      <section className="card-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            토픽
            <select
              value={activeTopicId}
              onChange={(event) => setSelectedTopicId(event.target.value)}
              className="bg-transparent text-xs text-[var(--text-primary)] outline-none"
            >
              <option value="" disabled>
                선택
              </option>
              {topicOptions.map((topic) => (
                <option key={topic.id} value={String(topic.id)}>
                  {getDisplayTopicName({
                    id: topic.id,
                    nameKo: topic.nameKo,
                    nameEn: topic.nameEn,
                    summaryKo: topic.summaryKo,
                    summaryEn: topic.summaryEn,
                  })}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            기간
            <select
              value={String(hours)}
              onChange={(event) => setHours(Number(event.target.value))}
              className="bg-transparent text-xs text-[var(--text-primary)] outline-none"
            >
              <option value="24">24h</option>
              <option value="72">72h</option>
              <option value="168">7d</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            리전
            <select
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value)}
              className="bg-transparent text-xs text-[var(--text-primary)] outline-none"
            >
              <option value="all">전체</option>
              {selectableRegions.map((region) => (
                <option key={region} value={region}>
                  {region.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card-panel p-5">
        {globalLoading || timelineLoading ? <LoadingSkeleton className="h-24" /> : null}

        {globalError ? (
          <EmptyState title="글로벌 토픽 목록을 불러오지 못했습니다." description="API 응답을 확인해 주세요." />
        ) : null}

        {timelineError ? (
          <EmptyState title="타임라인 데이터를 불러오지 못했습니다." description="잠시 후 다시 시도해 주세요." />
        ) : null}

        {!globalError && !globalLoading && topicOptions.length === 0 ? (
          <EmptyState
            title="선택 가능한 글로벌 토픽이 없습니다."
            description="글로벌 분석 배치 실행 후 다시 확인해 주세요."
          />
        ) : null}

        {!timelineError ? (
          <TopicTimeline
            points={timelineData?.timeline ?? []}
            title={selectedTopic ? `${selectedTopic.nameKo || selectedTopic.nameEn} 확산 흐름` : "토픽 타임라인"}
            emptyLabel={selectedTopic ? "선택한 토픽의 타임라인 데이터가 아직 없습니다." : "토픽을 먼저 선택해 주세요."}
          />
        ) : null}
      </section>
    </main>
  );
}
