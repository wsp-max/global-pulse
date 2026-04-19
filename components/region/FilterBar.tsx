"use client";

import type { TopicPeriod, TopicSort } from "@/lib/hooks/useTopics";

interface FilterBarProps {
  period: TopicPeriod;
  sort: TopicSort;
  onPeriodChange: (period: TopicPeriod) => void;
  onSortChange: (sort: TopicSort) => void;
}

const PERIOD_OPTIONS: Array<{ label: string; value: TopicPeriod }> = [
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
];

const SORT_OPTIONS: Array<{ label: string; value: TopicSort }> = [
  { label: "Heat", value: "heat" },
  { label: "Recent", value: "recent" },
  { label: "Sentiment", value: "sentiment" },
];

function chipClass(active: boolean): string {
  return active
    ? "border-[var(--text-accent)] bg-[var(--bg-tertiary)] text-[var(--text-accent)]"
    : "border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]";
}

export function FilterBar({ period, sort, onPeriodChange, onSortChange }: FilterBarProps) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">기간</span>
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPeriodChange(option.value)}
              className={`rounded-full border px-2 py-1 text-xs transition-colors ${chipClass(option.value === period)}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">정렬</span>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSortChange(option.value)}
              className={`rounded-full border px-2 py-1 text-xs transition-colors ${chipClass(option.value === sort)}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
