"use client";

import { getAllRegions, getRegionById, type GlobalTopic, type Topic } from "@global-pulse/shared";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { CrossRegionComparison } from "@/components/topic/CrossRegionComparison";
import { KeywordCloud } from "@/components/topic/KeywordCloud";
import { RelatedTopics, type RelatedTopicItem } from "@/components/topic/RelatedTopics";
import { TopicTimeline } from "@/components/topic/TopicTimeline";
import { useTopicDetail } from "@/lib/hooks/useTopicDetail";
import { useTopicTimeline } from "@/lib/hooks/useTopicTimeline";
import {
  buildNarrativeSummary,
  formatTimeOfDay,
  resolveNarrativeStage,
  toNarrativeStageLabel,
  type NarrativeStageKey,
} from "@/lib/utils/topic-narrative";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

interface TopicPageClientProps {
  topicId: string;
}

function mapLifecycleToNarrative(
  lifecycle: "emerging" | "peaking" | "fading" | null | undefined,
): NarrativeStageKey {
  if (lifecycle === "peaking") return "peaking";
  if (lifecycle === "fading") return "fading";
  return "emerging";
}

function stageToneClass(stage: NarrativeStageKey): string {
  if (stage === "fading") {
    return "border-slate-400/40 bg-slate-500/10 text-slate-200";
  }
  if (stage === "peaking") {
    return "border-amber-400/50 bg-amber-500/10 text-amber-200";
  }
  if (stage === "spreading") {
    return "border-cyan-400/40 bg-cyan-500/10 text-cyan-200";
  }
  return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
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
      title: getDisplayTopicName({
        id: topic.id,
        nameKo: topic.nameKo,
        nameEn: topic.nameEn,
        summaryKo: topic.summaryKo,
        summaryEn: topic.summaryEn,
      }),
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
      title: getDisplayTopicName({
        id: topic.id,
        regionId: topic.regionId,
        nameKo: topic.nameKo,
        nameEn: topic.nameEn,
        summaryKo: topic.summaryKo,
        summaryEn: topic.summaryEn,
        sampleTitles: topic.sampleTitles,
        keywords: topic.keywords,
        entities: topic.entities ?? [],
      }),
      subtitle: topic.regionId.toUpperCase(),
      href: `/topic/${topic.id}`,
      heatScore: topic.heatScore,
    }));
}

export function TopicPageClient({ topicId }: TopicPageClientProps) {
  const { data, error, isLoading } = useTopicDetail(topicId);
  const numericTopicId = Number(topicId);
  const resolvedTopicId = Number.isFinite(numericTopicId) ? numericTopicId : null;
  const { data: topicTimeline } = useTopicTimeline(resolvedTopicId);

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
          description="PostgreSQL 연결 상태를 확인하고 다시 시도해 주세요."
        />
      </main>
    );
  }

  const isGlobal = data.kind === "global";
  const globalTopic = data.globalTopic;
  const topic = data.topic;

  const title = isGlobal
    ? (globalTopic
        ? getDisplayTopicName({
            id: globalTopic.id,
            nameKo: globalTopic.nameKo,
            nameEn: globalTopic.nameEn,
            summaryKo: globalTopic.summaryKo,
            summaryEn: globalTopic.summaryEn,
          })
        : "Global Topic")
    : (topic
        ? getDisplayTopicName({
            id: topic.id,
            regionId: topic.regionId,
            nameKo: topic.nameKo,
            nameEn: topic.nameEn,
            summaryKo: topic.summaryKo,
            summaryEn: topic.summaryEn,
            sampleTitles: topic.sampleTitles,
            keywords: topic.keywords,
            entities: topic.entities ?? [],
          })
        : "Regional Topic");

  const subtitle = isGlobal
    ? buildNarrativeSummary({
        summaryKo: globalTopic?.summaryKo,
        summaryEn: globalTopic?.summaryEn,
        sampleTitles: data.regionalTopics.flatMap((item) => item.sampleTitles ?? []),
        keywords: data.keywords,
        fallbackText: "글로벌 확산 신호를 정리 중입니다.",
      })
    : buildNarrativeSummary({
        summaryKo: topic?.summaryKo,
        summaryEn: topic?.summaryEn,
        sampleTitles: topic?.sampleTitles ?? [],
        keywords: topic?.keywords ?? data.keywords,
        fallbackText: "리전 토픽 신호를 정리 중입니다.",
      });

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
  const totalRegions = getAllRegions().length;

  const stage: NarrativeStageKey = isGlobal
    ? resolveNarrativeStage({
        velocityPerHour: globalTopic?.velocityPerHour,
        acceleration: globalTopic?.acceleration,
        spreadScore: globalTopic?.spreadScore,
      })
    : mapLifecycleToNarrative(topicTimeline?.lifecycleStage ?? topic?.lifecycleStage);

  const firstSeenRegionId = isGlobal ? globalTopic?.firstSeenRegion : topic?.regionId;
  const firstSeenRegion = firstSeenRegionId ? getRegionById(firstSeenRegionId) : null;
  const firstSeenAt = isGlobal ? (globalTopic?.firstSeenAt ?? null) : (data.timeline[0]?.recordedAt ?? null);
  const expandedRegionCount = isGlobal ? Math.max(0, globalTopic?.regions?.length ?? 0) : topic?.regionId ? 1 : 0;

  return (
    <main className="page-shell">
      <header className="card-panel p-5">
        <p className="section-title">TOPIC DETAIL</p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
      </header>

      <section className="card-panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="card-title">이 이슈 지금</h2>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${stageToneClass(stage)}`}>
            {toNarrativeStageLabel(stage)}
          </span>
        </div>

        <div className="mt-3 grid gap-3 text-xs text-[var(--text-secondary)] sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">첫 관측</p>
            <p className="mt-1 text-[var(--text-primary)]">
              {firstSeenRegion ? `${firstSeenRegion.flagEmoji} ${firstSeenRegion.nameKo}` : "확인 중"}
            </p>
            <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">{formatTimeOfDay(firstSeenAt)}</p>
          </div>

          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">확산 범위</p>
            <p className="mt-1 text-[var(--text-primary)]">
              {expandedRegionCount.toLocaleString()} / {totalRegions.toLocaleString()} 리전
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {isGlobal ? "글로벌 확산 리전 기준" : "단일 리전 토픽 기준"}
            </p>
          </div>

          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">핵심 요약</p>
            <p className="mt-1 line-clamp-3 leading-relaxed text-[var(--text-primary)]">{subtitle}</p>
          </div>
        </div>
      </section>

      <CrossRegionComparison sentiments={sentiments} heatScores={heatScores} />
      <TopicTimeline points={data.timeline} />

      <section className="grid gap-4 lg:grid-cols-2">
        <KeywordCloud keywords={data.keywords} />
        <RelatedTopics title={isGlobal ? "연관 글로벌 이슈" : "연관 리전 토픽"} items={relatedItems} />
      </section>
    </main>
  );
}

