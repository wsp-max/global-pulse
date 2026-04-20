"use client";

import { useCallback, useMemo, useState } from "react";
import type { Topic } from "@global-pulse/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { KeywordCloud } from "@/components/topic/KeywordCloud";
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

function hasPlaceholderSummary(summary: string | null | undefined): boolean {
  if (!summary) {
    return true;
  }

  const normalized = summary.trim();
  return (
    normalized.startsWith("요약 준비 중") ||
    normalized.startsWith("Summary pending") ||
    normalized.startsWith("핵심 키워드")
  );
}

function firstSummarySentence(summary: string | null | undefined): string | null {
  if (!summary || hasPlaceholderSummary(summary)) {
    return null;
  }

  const first = summary
    .split(/[.!?。！？]\s|$/u)
    .map((item) => item.trim())
    .filter(Boolean)[0];

  if (!first) {
    return null;
  }

  if (first.length <= 80) {
    return first;
  }

  return `${first.slice(0, 80).trim()}…`;
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
    <main className="page-shell">
      <RegionHeader regionId={regionId} snapshot={data?.snapshot} />

      <FilterBar
        period={period}
        sort={sort}
        onPeriodChange={(nextPeriod) => updateFilter({ period: nextPeriod })}
        onSortChange={(nextSort) => updateFilter({ sort: nextSort })}
      />

      <section className="card-panel p-5">
        <h2 className="card-title mb-3">열기 추이</h2>
        {timelineLoading ? <LoadingSkeleton className="h-32" /> : <TrendChart points={timeline} />}
      </section>

      {error ? <EmptyState title={t("dashboard.loadError")} description={t("dashboard.loadErrorDesc")} /> : null}

      {!error && !isLoading && topics.length === 0 ? (
        <EmptyState title={t("dashboard.empty.topics")} description={t("dashboard.error.globalRetry")} />
      ) : null}

      {!error && (isLoading || topics.length > 0) ? (
        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="card-panel p-5">
            <h2 className="card-title mb-3">Top Topics</h2>
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

          <div className="space-y-4">
            <section className="card-panel p-5">
              <h2 className="card-title">선택 토픽 요약</h2>
              <p className="card-sub mt-1">{selectedTopic?.nameKo ?? "토픽 상세"}</p>
              {firstSummarySentence(selectedTopic?.summaryKo ?? null) ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {firstSummarySentence(selectedTopic?.summaryKo ?? null)}
                </p>
              ) : null}
              <div className="mt-3">
                <SentimentGauge value={selectedTopic?.sentiment ?? null} />
              </div>
              <div className="meta-xs mt-3">
                게시글 {selectedTopic?.postCount ?? 0} / 댓글 {selectedTopic?.totalComments ?? 0}
              </div>
            </section>

            <section className="card-panel p-5">
              <h2 className="card-title mb-3">출처 분포</h2>
              <SourceBreakdown sourceIds={selectedTopic?.sourceIds ?? []} />
            </section>

            <KeywordCloud keywords={selectedTopic?.keywords ?? []} />
          </div>
        </section>
      ) : null}
    </main>
  );
}

