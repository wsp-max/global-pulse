"use client";

import type { Topic } from "@global-pulse/shared";
import { useLanguage } from "@/lib/i18n/use-language";
import { toHeatBand } from "@/lib/utils/heat";
import { cleanupTopicName } from "@/lib/utils/topic-name";
import { TopicCard } from "./TopicCard";

interface TopicListProps {
  topics: Topic[];
  selectedTopicId?: number;
  onSelect?: (topic: Topic) => void;
}

function deriveHeatTrend(miniTrend: number[] | null | undefined): number | null {
  if (!miniTrend || miniTrend.length < 2) {
    return null;
  }
  const first = miniTrend[0] ?? 0;
  const last = miniTrend[miniTrend.length - 1] ?? 0;
  return ((last - first) / Math.max(first, 1)) * 100;
}

export function TopicList({ topics, selectedTopicId, onSelect }: TopicListProps) {
  const { t } = useLanguage("ko");

  if (topics.length === 0) {
    return <div className="text-sm text-[var(--text-secondary)]">{t("dashboard.empty.topics")}</div>;
  }

  const maxHeat = Math.max(...topics.map((topic) => topic.heatScore), 1);

  return (
    <div className="space-y-2">
      {topics.map((topic, index) => {
        const heatBand = toHeatBand(topic.heatScore, maxHeat);
        const cleaned = cleanupTopicName({
          id: topic.id,
          regionId: topic.regionId,
          nameKo: topic.nameKo,
          nameEn: topic.nameEn,
          keywords: topic.keywords,
          entities: topic.entities ?? null,
        });
        return (
          <TopicCard
            key={topic.id ?? `${topic.nameEn}-${index}`}
            rank={topic.rank ?? index + 1}
            name={cleaned.displayKo}
            heatScore={topic.heatScore}
            heatBand={heatBand}
            summaryKo={topic.summaryKo ?? null}
            sentimentDistribution={topic.sentimentDistribution ?? null}
            sentiment={topic.sentiment}
            heatTrend={deriveHeatTrend(topic.miniTrend ?? null)}
            isFallbackName={cleaned.isFallback}
            nameRefiningLabel={t("dashboard.badge.nameRefining")}
            selected={topic.id === selectedTopicId}
            onClick={() => onSelect?.(topic)}
          />
        );
      })}
    </div>
  );
}
