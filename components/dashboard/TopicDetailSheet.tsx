"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useTopicDetail } from "@/lib/hooks/useTopicDetail";

interface TopicDetailSheetProps {
  topicId: number | null;
  onClose: () => void;
}

export function TopicDetailSheet({ topicId, onClose }: TopicDetailSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { data, isLoading, error } = useTopicDetail(topicId ? String(topicId) : "");

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
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{resolved.title}</h2>
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

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Timeline</p>
                <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                  {(data?.timeline ?? []).slice(0, 8).map((point) => (
                    <p key={`${point.regionId}-${point.recordedAt}`}>
                      {point.regionId.toUpperCase()} · {new Date(point.recordedAt).toLocaleString("ko-KR")} · heat {Math.round(point.heatScore)}
                    </p>
                  ))}
                  {(data?.timeline ?? []).length === 0 && <p>타임라인 데이터 없음</p>}
                </div>
              </article>

              <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Related Topics</p>
                <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                  {(data?.relatedTopics ?? []).slice(0, 5).map((topic) => (
                    typeof topic.id === "number" ? (
                      <Link key={topic.id} href={`/topic/${topic.id}`} className="block hover:text-[var(--text-primary)]">
                        {topic.nameKo || topic.nameEn}
                      </Link>
                    ) : null
                  ))}
                  {(data?.relatedGlobalTopics ?? []).slice(0, 5).map((topic) => (
                    typeof topic.id === "number" ? (
                      <Link key={`g-${topic.id}`} href={`/topic/${topic.id}`} className="block hover:text-[var(--text-primary)]">
                        {topic.nameKo || topic.nameEn}
                      </Link>
                    ) : null
                  ))}
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
