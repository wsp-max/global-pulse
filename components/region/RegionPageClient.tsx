"use client";

import { useCallback, useMemo, useState } from "react";
import type { Topic } from "@global-pulse/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useTimeline } from "@/lib/hooks/useTimeline";
import { useTopics, type TopicPeriod, type TopicSort } from "@/lib/hooks/useTopics";
import { useLanguage } from "@/lib/i18n/use-language";
import { FilterBar } from "./FilterBar";
import { RegionHeader } from "./RegionHeader";
import { SentimentGauge } from "./SentimentGauge";
import { SourceBreakdown } from "./SourceBreakdown";
import { TopicList } from "./TopicList";
import { TrendChart } from "./TrendChart";

interface RegionPageClientProps {
  regionId: string;
}

const PERIOD_OPTIONS: TopicPeriod[] = ["1h", "6h", "24h", "7d"];
const SORT_OPTIONS: TopicSort[] = ["heat", "recent", "sentiment"];

function parsePeriod(input: string | null): TopicPeriod {
  if (!input) return "24h";
  return PERIOD_OPTIONS.includes(input as TopicPeriod) ? (input as TopicPeriod) : "24h";
}

function parseSort(input: string | null): TopicSort {
  if (!input) return "heat";
  return SORT_OPTIONS.includes(input as TopicSort) ? (input as TopicSort) : "heat";
}

export function RegionPageClient({ regionId }: RegionPageClientProps) {
  const { t } = useLanguage("ko");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const period = parsePeriod(searchParams?.get("period") ?? null);
  const sort = parseSort(searchParams?.get("sort") ?? null);

  const { data, isLoading, error } = useTopics(regionId, {
    limit: 30,
    period,
    sort,
  });
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

  const { data: timelineData, isLoading: timelineLoading } = useTimeline(selectedTopic?.nameEn, regionId, 24);
  const timeline = timelineData?.timeline ?? [];

  const updateFilter = useCallback(
    (next: { period?: TopicPeriod; sort?: TopicSort }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const nextPeriod = next.period ?? period;
      const nextSort = next.sort ?? sort;

      params.set("period", nextPeriod);
      params.set("sort", nextSort);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, period, router, searchParams, sort],
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6">
      <RegionHeader regionId={regionId} snapshot={data?.snapshot} />
      <FilterBar
        period={period}
        sort={sort}
        onPeriodChange={(nextPeriod) => updateFilter({ period: nextPeriod })}
        onSortChange={(nextSort) => updateFilter({ sort: nextSort })}
      />

      {timelineLoading ? <LoadingSkeleton className="h-32" /> : <TrendChart points={timeline} />}

      {error && (
        <EmptyState
          title={t("dashboard.loadError")}
          description={t("dashboard.loadErrorDesc")}
        />
      )}

      {!error && !isLoading && topics.length === 0 && (
        <EmptyState
          title={t("dashboard.empty.topics")}
          description={t("dashboard.error.globalRetry")}
        />
      )}

      {!error && (isLoading || topics.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="order-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 lg:order-1">
            <h2 className="mb-3 text-sm font-semibold">Top Topics</h2>
            {isLoading ? (
              <LoadingSkeleton className="h-44" lines={5} />
            ) : (
              <TopicList
                topics={topics}
                selectedTopicId={selectedTopic?.id}
                onSelect={(topic: Topic) => setSelectedTopicId(topic.id)}
              />
            )}
          </div>

          <div className="order-1 space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 lg:order-2">
            <h2 className="text-sm font-semibold">{selectedTopic?.nameKo ?? "Topic Detail"}</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {selectedTopic?.summaryKo ?? "요약 데이터가 아직 없습니다."}
            </p>
            <SentimentGauge value={selectedTopic?.sentiment ?? null} />
            <SourceBreakdown sourceIds={selectedTopic?.sourceIds ?? []} />
            <div className="text-xs text-[var(--text-tertiary)]">
              게시글 {selectedTopic?.postCount ?? 0} / 댓글 {selectedTopic?.totalComments ?? 0}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
