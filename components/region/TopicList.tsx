"use client";

import type { Topic } from "@global-pulse/shared";
import { toHeatBand } from "@/lib/utils/heat";
import { cleanupTopicName } from "@/lib/utils/topic-name";
import { TopicCard } from "./TopicCard";

interface TopicListProps {
  topics: Topic[];
  selectedTopicId?: number;
  onSelect?: (topic: Topic) => void;
}

export function TopicList({ topics, selectedTopicId, onSelect }: TopicListProps) {
  if (topics.length === 0) {
    return <div className="text-sm text-[var(--text-secondary)]">표시할 토픽이 없습니다.</div>;
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
            isFallbackName={cleaned.isFallback}
            selected={topic.id === selectedTopicId}
            onClick={() => onSelect?.(topic)}
          />
        );
      })}
    </div>
  );
}
