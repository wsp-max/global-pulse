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
  if (typeof topic.sentiment !== "number" || !Number.isFinite(topic.sentiment)) {
    return {};
  }
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
      <main className="page-shell">
        <LoadingSkeleton className="h-28" lines={4} />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="page-shell">
        <EmptyState title="토픽 상세 데이터를 불러오지 못했습니다." description="잠시 후 다시 시도해 주세요." />
      </main>
    );
  }

  if (data.kind === "not_configured") {
    return (
      <main className="page-shell">
        <EmptyState
          title="데이터베이스 설정이 필요합니다."
          description="PostgreSQL 연결 상태를 확인한 뒤 다시 시도해 주세요."
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
    ? (globalTopic?.summaryKo ?? globalTopic?.summaryEn ?? "요약 준비 중")
    : (topic?.summaryKo ?? topic?.summaryEn ?? "요약 준비 중");

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

  const relatedItems = isGlobal ? toGlobalRelatedItems(data.relatedGlobalTopics) : toRegionalRelatedItems(data.relatedTopics);

  return (
    <main className="page-shell">
      <header className="card-panel p-5">
        <p className="section-title">TOPIC DETAIL</p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
      </header>

      <CrossRegionComparison sentiments={sentiments} heatScores={heatScores} />
      <TopicTimeline points={data.timeline} />

      <section className="grid gap-4 lg:grid-cols-2">
        <KeywordCloud keywords={data.keywords} />
        <RelatedTopics title={isGlobal ? "연관 글로벌 이슈" : "연관 리전 토픽"} items={relatedItems} />
      </section>
    </main>
  );
}
