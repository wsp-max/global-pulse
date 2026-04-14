"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import type { GlobalTopic, Topic } from "@global-pulse/shared";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

interface SearchResponse {
  topics: Topic[];
  globalTopics: GlobalTopic[];
  total: number;
}

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const normalizedBasePath = rawBasePath
  ? rawBasePath.startsWith("/")
    ? rawBasePath.replace(/\/+$/, "")
    : `/${rawBasePath.replace(/\/+$/, "")}`
  : "";

const fetcher = async (url: string): Promise<SearchResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch search results: ${response.status}`);
  }
  return (await response.json()) as SearchResponse;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const endpoint = useMemo(() => {
    if (!submittedQuery.trim()) {
      return null;
    }
    return `${normalizedBasePath}/api/search?q=${encodeURIComponent(submittedQuery.trim())}`;
  }, [submittedQuery]);

  const { data, isLoading, error } = useSWR(endpoint, fetcher);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 lg:px-6">
      <header className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <h1 className="text-lg font-semibold">Search Topics</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Search regional topics and global issues from collected data.
        </p>
      </header>

      <form
        className="grid gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 md:grid-cols-[1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedQuery(query);
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type keyword..."
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]"
        />
        <button
          type="submit"
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]"
        >
          Search
        </button>
      </form>

      {!submittedQuery.trim() && (
        <EmptyState title="검색어를 입력하세요." description="키워드로 리전 토픽과 글로벌 이슈를 동시에 조회할 수 있습니다." />
      )}

      {isLoading && <LoadingSkeleton className="h-24" lines={4} />}

      {error && (
        <EmptyState
          title="검색 요청에 실패했습니다."
          description={error instanceof Error ? error.message : "Search failed"}
        />
      )}

      {data && (
        <section className="space-y-4">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Regional Topics ({data.topics.length})
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.topics.map((topic) => (
                <li
                  key={`${topic.regionId}-${topic.id ?? topic.nameEn}`}
                  className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2"
                >
                  <div className="font-medium text-[var(--text-primary)]">{topic.nameKo || topic.nameEn}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    region={topic.regionId} heat={topic.heatScore.toFixed(1)}
                  </div>
                </li>
              ))}
              {data.topics.length === 0 && (
                <li className="text-xs text-[var(--text-secondary)]">No regional topics found.</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Global Topics ({data.globalTopics.length})
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.globalTopics.map((topic) => (
                <li
                  key={`global-${topic.id ?? topic.nameEn}`}
                  className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2"
                >
                  <div className="font-medium text-[var(--text-primary)]">{topic.nameKo || topic.nameEn}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    regions={topic.regions.join(", ")} heat={topic.totalHeatScore.toFixed(1)}
                  </div>
                </li>
              ))}
              {data.globalTopics.length === 0 && (
                <li className="text-xs text-[var(--text-secondary)]">No global topics found.</li>
              )}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}

