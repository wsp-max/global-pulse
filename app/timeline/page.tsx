"use client";

import { useMemo, useState } from "react";
import type { GlobalTopic } from "@global-pulse/shared";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { TopicTimeline } from "@/components/topic/TopicTimeline";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";
import { useTimeline } from "@/lib/hooks/useTimeline";

export default function TimelinePage() {
  const { data: globalData, isLoading: globalLoading, error: globalError } = useGlobalTopics(50);
  const globalTopics = useMemo(() => globalData?.globalTopics ?? [], [globalData?.globalTopics]);

  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [hours, setHours] = useState<number>(72);

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

  const timelineQuery = selectedTopic ? (selectedTopic.nameEn || selectedTopic.nameKo) : undefined;
  const { data: timelineData, isLoading: timelineLoading, error: timelineError } = useTimeline(
    timelineQuery,
    undefined,
    hours,
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 lg:px-6">
      <header className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <h1 className="text-lg font-semibold">토픽 확산 타임라인</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          글로벌 이슈가 리전별로 어떻게 확산되는지 시간 순으로 추적합니다.
        </p>
      </header>

      <section className="grid gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 md:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
          글로벌 토픽 선택
          <select
            value={activeTopicId}
            onChange={(event) => setSelectedTopicId(event.target.value)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="" disabled>
              토픽을 선택하세요
            </option>
            {topicOptions.map((topic) => (
              <option key={topic.id} value={String(topic.id)}>
                {topic.nameKo || topic.nameEn}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
          조회 범위
          <select
            value={String(hours)}
            onChange={(event) => setHours(Number(event.target.value))}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="24">24시간</option>
            <option value="72">72시간</option>
            <option value="168">7일</option>
          </select>
        </label>
      </section>

      {(globalLoading || timelineLoading) && <LoadingSkeleton className="h-24" />}

      {globalError && (
        <EmptyState
          title="글로벌 토픽 목록을 불러오지 못했습니다."
          description="API 응답을 확인해 주세요."
        />
      )}

      {timelineError && (
        <EmptyState title="타임라인 데이터를 불러오지 못했습니다." description="잠시 후 다시 시도해 주세요." />
      )}

      {!globalError && !globalLoading && topicOptions.length === 0 && (
        <EmptyState
          title="선택 가능한 글로벌 토픽이 없습니다."
          description="global analysis 배치 실행 후 다시 확인해 주세요."
        />
      )}

      {!timelineError && (
        <TopicTimeline
          points={timelineData?.timeline ?? []}
          title={selectedTopic ? `${selectedTopic.nameKo || selectedTopic.nameEn} 확산 흐름` : "토픽 타임라인"}
          emptyLabel={
            selectedTopic
              ? "선택한 토픽의 확산 데이터가 아직 없습니다."
              : "먼저 글로벌 토픽을 선택하세요."
          }
        />
      )}
    </main>
  );
}

