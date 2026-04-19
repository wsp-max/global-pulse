"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useTopicDetail } from "@/lib/hooks/useTopicDetail";
import { useTopicTimeline } from "@/lib/hooks/useTopicTimeline";

interface TopicDetailSheetProps {
  topicId: number | null;
  onClose: () => void;
}

function buildSparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
      return `${x},${Number(y.toFixed(2))}`;
    })
    .join(" ");
}

function lifecycleClass(stage: "emerging" | "peaking" | "fading" | null | undefined): string {
  if (stage === "fading") {
    return "border-slate-400/40 bg-slate-500/10 text-slate-200";
  }
  if (stage === "peaking") {
    return "border-amber-400/50 bg-amber-500/10 text-amber-200";
  }
  return "border-cyan-400/40 bg-cyan-500/10 text-cyan-200";
}

export function TopicDetailSheet({ topicId, onClose }: TopicDetailSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { data, isLoading, error } = useTopicDetail(topicId ? String(topicId) : "");
  const { data: timelineData } = useTopicTimeline(topicId);

  useEffect(() => {
    if (!topicId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [topicId, onClose]);

  const resolved = useMemo(() => {
    if (!data) {
      return {
        title: "토픽 상세",
        subtitle: "요약 준비 중",
        keywords: [] as string[],
      };
    }

    if (data.kind === "global" && data.globalTopic) {
      return {
        title: data.globalTopic.nameKo || data.globalTopic.nameEn,
        subtitle: data.globalTopic.summaryKo || data.globalTopic.summaryEn || "요약 준비 중",
        keywords: data.keywords.slice(0, 20),
      };
    }

    if (data.topic) {
      return {
        title: data.topic.nameKo || data.topic.nameEn,
        subtitle: data.topic.summaryKo || data.topic.summaryEn || "요약 준비 중",
        keywords: data.topic.keywords.slice(0, 20),
      };
    }

    return {
      title: "토픽 상세",
      subtitle: "요약 준비 중",
      keywords: [] as string[],
    };
  }, [data]);

  const sparklineValues = timelineData?.buckets.map((item) => item.heatScore) ?? [];
  const sparkline = buildSparklinePoints(sparklineValues, 240, 40);
  const lifecycleStage = timelineData?.lifecycleStage ?? data?.topic?.lifecycleStage ?? "emerging";
  const sourceDiversity = data?.topic?.sourceDiversity ?? null;
  const dominantSourceShare = data?.topic?.dominantSourceShare ?? null;

  if (!topicId) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-2 sm:items-center sm:p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="토픽 상세"
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{resolved.title}</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${lifecycleClass(lifecycleStage)}`}>
                {lifecycleStage}
              </span>
              {dominantSourceShare !== null && dominantSourceShare > 0.8 ? (
                <span className="rounded-full border border-slate-500/40 bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-200">
                  ⚠️ 단일 출처
                </span>
              ) : null}
              {sourceDiversity !== null && sourceDiversity > 0.7 ? (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                  ✅ 다출처 검증
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{resolved.subtitle}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="상세 패널 닫기"
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-[var(--border-default)] text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)]"
          >
            ✕
          </button>
        </div>

        {isLoading && (
          <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-secondary)]">
            상세 데이터를 불러오는 중입니다...
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            상세 데이터를 불러오지 못했습니다.
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {resolved.keywords.length > 0 ? (
                resolved.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                  >
                    {keyword}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--text-tertiary)]">키워드 수집 대기</span>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
              <p className="text-xs text-[var(--text-tertiary)]">Heat Sparkline (6h)</p>
              <div className="mt-2 h-12 w-full rounded-md bg-[rgba(15,23,42,0.55)] p-1">
                {sparkline ? (
                  <svg viewBox="0 0 240 40" className="h-full w-full" role="img" aria-label="토픽 열기 스파크라인">
                    <polyline
                      points={sparkline}
                      fill="none"
                      stroke="var(--text-accent)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <div className="flex h-full items-center text-xs text-[var(--text-tertiary)]">시계열 데이터 수집 중</div>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Timeline</p>
                <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                  {(timelineData?.buckets ?? []).slice(-8).map((point) => (
                    <p key={`${point.bucketAt}`}>
                      {new Date(point.bucketAt).toLocaleString("ko-KR")} · heat {Math.round(point.heatScore)} · posts {point.postCount}
                    </p>
                  ))}
                  {(timelineData?.buckets ?? []).length === 0 && <p>타임라인 데이터 없음</p>}
                </div>
              </article>

              <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Related Topics</p>
                <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                  {(data?.relatedTopics ?? []).slice(0, 5).map((topic) =>
                    typeof topic.id === "number" ? (
                      <Link key={topic.id} href={`/topic/${topic.id}`} className="block hover:text-[var(--text-primary)]">
                        {topic.nameKo || topic.nameEn}
                      </Link>
                    ) : null,
                  )}
                  {(data?.relatedGlobalTopics ?? []).slice(0, 5).map((topic) =>
                    typeof topic.id === "number" ? (
                      <Link key={`g-${topic.id}`} href={`/topic/${topic.id}`} className="block hover:text-[var(--text-primary)]">
                        {topic.nameKo || topic.nameEn}
                      </Link>
                    ) : null,
                  )}
                  {(data?.relatedTopics ?? []).length === 0 && (data?.relatedGlobalTopics ?? []).length === 0 && (
                    <p>연관 토픽이 없습니다.</p>
                  )}
                </div>
              </article>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-secondary)]">
              대표 언급 3건: 원문 수집 대기
            </div>
          </>
        )}
      </section>
    </div>
  );
}

