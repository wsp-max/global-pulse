"use client";

import type { GlobalTopic, Topic } from "@global-pulse/shared";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { CrossRegionComparison } from "@/components/topic/CrossRegionComparison";
import { KeywordCloud } from "@/components/topic/KeywordCloud";
import { RelatedTopics, type RelatedTopicItem } from "@/components/topic/RelatedTopics";
import { TopicTimeline } from "@/components/topic/TopicTimeline";
import { useTopicDetail } from "@/lib/hooks/useTopicDetail";

interface TopicPageClientProps {
  topicId: string;
}

function buildRegionalSentiments(topic: Topic): Record<string, number> {
  return { [topic.regionId]: topic.sentiment };
}

function buildRegionalHeat(topic: Topic): Record<string, number> {
  return { [topic.regionId]: topic.heatScore };
}

function toGlobalRelatedItems(topics: GlobalTopic[]): RelatedTopicItem[] {
  return topics
    .filter((topic): topic is GlobalTopic & { id: number } => typeof topic.id === "number")
    .slice(0, 8)
    .map((topic) => ({
      id: topic.id,
      title: topic.nameKo || topic.nameEn,
      subtitle: topic.regions.map((regionId) => regionId.toUpperCase()).join(" · "),
      href: `/topic/${topic.id}`,
      heatScore: topic.totalHeatScore,
    }));
}

function toRegionalRelatedItems(topics: Topic[]): RelatedTopicItem[] {
  return topics
    .filter((topic): topic is Topic & { id: number } => typeof topic.id === "number")
    .slice(0, 8)
    .map((topic) => ({
      id: topic.id,
      title: topic.nameKo || topic.nameEn,
      subtitle: topic.regionId.toUpperCase(),
      href: `/topic/${topic.id}`,
      heatScore: topic.heatScore,
    }));
}

export function TopicPageClient({ topicId }: TopicPageClientProps) {
  const { data, error, isLoading } = useTopicDetail(topicId);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        <LoadingSkeleton className="h-28" lines={4} />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        <EmptyState
          title="토픽 상세 데이터를 불러오지 못했습니다."
          description="잠시 후 다시 시도해 주세요."
        />
      </main>
    );
  }

  if (data.kind === "not_configured") {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        <EmptyState
          title="데이터베이스 설정이 필요합니다."
          description="PostgreSQL 연결을 확인한 뒤 다시 시도해 주세요."
        />
      </main>
    );
  }

  const isGlobal = data.kind === "global";
  const globalTopic = data.globalTopic;
  const topic = data.topic;

  const title = isGlobal
    ? (globalTopic?.nameKo ?? globalTopic?.nameEn ?? "Global Topic")
    : (topic?.nameKo ?? topic?.nameEn ?? "Regional Topic");

  const subtitle = isGlobal
    ? (globalTopic?.summaryKo ?? globalTopic?.summaryEn ?? "글로벌 이슈 요약이 아직 없습니다.")
    : (topic?.summaryKo ?? topic?.summaryEn ?? "리전 토픽 요약이 아직 없습니다.");

  const sentiments = isGlobal
    ? (globalTopic?.regionalSentiments ?? {})
    : topic
      ? buildRegionalSentiments(topic)
      : {};
  const heatScores = isGlobal
    ? (globalTopic?.regionalHeatScores ?? {})
    : topic
      ? buildRegionalHeat(topic)
      : {};

  const relatedItems = isGlobal
    ? toGlobalRelatedItems(data.relatedGlobalTopics)
    : toRegionalRelatedItems(data.relatedTopics);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{subtitle}</p>
      </header>

      <CrossRegionComparison sentiments={sentiments} heatScores={heatScores} />
      <TopicTimeline points={data.timeline} />
      <KeywordCloud keywords={data.keywords} />
      <RelatedTopics title={isGlobal ? "연관 글로벌 이슈" : "같은 리전 연관 토픽"} items={relatedItems} />
    </main>
  );
}

