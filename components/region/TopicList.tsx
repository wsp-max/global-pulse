"use client";

import type { Topic } from "@global-pulse/shared";
import { toHeatBand } from "@/lib/utils/heat";
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
        return (
          <TopicCard
            key={topic.id ?? `${topic.nameEn}-${index}`}
            rank={topic.rank ?? index + 1}
            name={topic.nameKo}
            heatScore={topic.heatScore}
            heatBand={heatBand}
            selected={topic.id === selectedTopicId}
            onClick={() => onSelect?.(topic)}
          />
        );
      })}
    </div>
  );
}
