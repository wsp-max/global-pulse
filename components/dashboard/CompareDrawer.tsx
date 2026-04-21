"use client";

import { useEffect, useMemo, useState } from "react";
import type { Topic } from "@global-pulse/shared";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

interface TimelineBucket {
  bucketAt: string;
  heatScore: number;
  postCount: number;
}

interface TimelineResponse {
  topicId: number;
  regionId: string | null;
  topicName: string | null;
  lifecycleStage: "emerging" | "peaking" | "fading";
  buckets: TimelineBucket[];
}

interface CompareDrawerProps {
  open: boolean;
  topics: Topic[];
  pinnedTopicIds: number[];
  onTogglePin: (topicId: number) => void;
  onClose: () => void;
  onTopicSelect?: (topicId: number) => void;
}

const LINE_COLORS = ["#38BDF8", "#F59E0B", "#10B981"];

function normalizeBasePath(input?: string): string {
  const raw = input?.trim() ?? "";
  if (!raw) return "";
  return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
}

function runtimeBasePath(): string {
  const envBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  if (envBasePath) {
    return envBasePath;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return window.location.pathname === "/pulse" || window.location.pathname.startsWith("/pulse/")
    ? "/pulse"
    : "";
}

function toSeriesPath(values: number[], width: number, height: number, maxHeat: number): string {
  if (values.length === 0) {
    return "";
  }
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / maxHeat) * height;
      return `${Number(x.toFixed(2))},${Number(y.toFixed(2))}`;
    })
    .join(" ");
}

export function CompareDrawer({
  open,
  topics,
  pinnedTopicIds,
  onTogglePin,
  onClose,
  onTopicSelect,
}: CompareDrawerProps) {
  const [timelineMap, setTimelineMap] = useState<Record<number, TimelineResponse>>({});

  const pinnedTopics = useMemo(() => {
    const byId = new Map<number, Topic>();
    for (const topic of topics) {
      if (typeof topic.id === "number" && !byId.has(topic.id)) {
        byId.set(topic.id, topic);
      }
    }
    return pinnedTopicIds
      .map((topicId) => byId.get(topicId))
      .filter((topic): topic is Topic => Boolean(topic));
  }, [pinnedTopicIds, topics]);

  useEffect(() => {
    if (!open || pinnedTopicIds.length === 0) {
      return;
    }

    const missingIds = pinnedTopicIds.filter((id) => !timelineMap[id]);
    if (missingIds.length === 0) {
      return;
    }

    let cancelled = false;
    const basePath = runtimeBasePath();

    const load = async () => {
      const responses = await Promise.all(
        missingIds.map(async (topicId) => {
          try {
            const response = await fetch(`${basePath}/api/topic/${topicId}/timeline`, {
              cache: "no-store",
            });
            if (!response.ok) {
              return null;
            }
            const json = (await response.json()) as TimelineResponse;
            return { topicId, json };
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setTimelineMap((prev) => {
        const next = { ...prev };
        for (const result of responses) {
          if (!result) {
            continue;
          }
          next[result.topicId] = result.json;
        }
        return next;
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, pinnedTopicIds, timelineMap]);

  const timelineSeries = useMemo(() => {
    return pinnedTopics.map((topic) => {
      const topicId = topic.id as number;
      const timeline = timelineMap[topicId];
      const values = (timeline?.buckets ?? []).map((bucket) => bucket.heatScore);
      return {
        topic,
        values,
      };
    });
  }, [pinnedTopics, timelineMap]);

  const maxHeat = Math.max(
    1,
    ...timelineSeries.flatMap((series) => series.values),
    ...pinnedTopics.map((topic) => topic.heatScore),
  );

  if (!open) {
    return null;
  }

  return (
    <aside
      className="fixed inset-y-0 right-0 z-[85] w-full max-w-md border-l border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-card)]"
      aria-label="비교 드로어"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-sm tracking-[0.12em] text-[var(--text-accent)]">COMPARE TOPICS</p>
          <p className="text-xs text-[var(--text-secondary)]">최대 3개 토픽 시계열 오버레이</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="비교 드로어 닫기"
          className="rounded-md border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
        >
          닫기
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
        <p className="text-xs text-[var(--text-tertiary)]">Pinned Timelines</p>
        <div className="mt-2 h-32 rounded-md border border-[var(--border-default)] bg-[rgba(15,23,42,0.6)] p-2">
          {pinnedTopics.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-[var(--text-tertiary)]">
              비교할 토픽을 선택하세요.
            </div>
          ) : (
            <svg viewBox="0 0 280 110" className="h-full w-full" role="img" aria-label="토픽 비교 시계열">
              {timelineSeries.map((series, index) => {
                const points = toSeriesPath(series.values, 280, 110, maxHeat);
                if (!points) {
                  return null;
                }
                return (
                  <polyline
                    key={`series-${series.topic.id}`}
                    points={points}
                    fill="none"
                    stroke={LINE_COLORS[index % LINE_COLORS.length]}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
            </svg>
          )}
        </div>

        <div className="mt-2 space-y-1">
          {pinnedTopics.map((topic, index) => {
            const isLoading = !timelineMap[topic.id as number];
            const title = getDisplayTopicName({
              id: topic.id,
              regionId: topic.regionId,
              nameKo: topic.nameKo,
              nameEn: topic.nameEn,
              summaryKo: topic.summaryKo,
              summaryEn: topic.summaryEn,
              sampleTitles: topic.sampleTitles,
              keywords: topic.keywords,
              entities: topic.entities ?? [],
            });
            return (
              <div key={`legend-${topic.id}`} className="flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => topic.id && onTopicSelect?.(topic.id)}
                  className="flex items-center gap-2 text-left text-[var(--text-primary)] hover:text-[var(--text-accent)]"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }}
                    aria-hidden
                  />
                  <span className="truncate">{title}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-tertiary)]">{isLoading ? "loading" : `heat ${Math.round(topic.heatScore)}`}</span>
                  <button
                    type="button"
                    onClick={() => topic.id && onTogglePin(topic.id)}
                    className="rounded border border-[var(--border-default)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                  >
                    제거
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 max-h-[58vh] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-2">
        <p className="px-1 pb-2 text-xs text-[var(--text-tertiary)]">토픽 선택</p>
        <div className="space-y-1">
          {topics.slice(0, 40).map((topic) => {
            if (typeof topic.id !== "number") {
              return null;
            }
            const pinned = pinnedTopicIds.includes(topic.id);
            const disabled = !pinned && pinnedTopicIds.length >= 3;
            const title = getDisplayTopicName({
              id: topic.id,
              regionId: topic.regionId,
              nameKo: topic.nameKo,
              nameEn: topic.nameEn,
              summaryKo: topic.summaryKo,
              summaryEn: topic.summaryEn,
              sampleTitles: topic.sampleTitles,
              keywords: topic.keywords,
              entities: topic.entities ?? [],
            });

            return (
              <div
                key={`candidate-${topic.id}`}
                className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-default)] px-2 py-1.5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-xs text-[var(--text-primary)] hover:text-[var(--text-accent)]"
                  onClick={() => onTopicSelect?.(topic.id!)}
                >
                  <p className="truncate">{title}</p>
                  <p className="truncate text-[10px] text-[var(--text-tertiary)]">
                    {topic.regionId.toUpperCase()} · heat {Math.round(topic.heatScore)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePin(topic.id!)}
                  disabled={disabled}
                  aria-label={`${title} 비교 고정`}
                  className="rounded border border-[var(--border-default)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pinned ? "해제" : "비교"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
