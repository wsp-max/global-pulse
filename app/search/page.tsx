"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useLanguage } from "@/lib/i18n/use-language";
import type { SearchApiResponse } from "@/lib/types/api";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const normalizedBasePath = rawBasePath
  ? rawBasePath.startsWith("/")
    ? rawBasePath.replace(/\/+$/, "")
    : `/${rawBasePath.replace(/\/+$/, "")}`
  : "";

const fetcher = async (url: string): Promise<SearchApiResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch search results: ${response.status}`);
  }
  return (await response.json()) as SearchApiResponse;
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const { t } = useLanguage("ko");

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
        <h1 className="text-lg font-semibold">{t("search.title")}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("search.description")}</p>
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
          placeholder={t("search.placeholder")}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]"
        />
        <button
          type="submit"
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]"
        >
          {t("search.button")}
        </button>
      </form>

      {!submittedQuery.trim() && <EmptyState title={t("search.empty")} description={t("search.description")} />}

      {isLoading && <LoadingSkeleton className="h-24" lines={4} />}

      {error && (
        <EmptyState
          title={t("search.failed")}
          description={error instanceof Error ? error.message : "Search failed"}
        />
      )}

      {data && (
        <section className="space-y-4">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t("search.regional")} ({data.topics.length})
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
                <li className="text-xs text-[var(--text-secondary)]">{t("search.noRegional")}</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t("search.global")} ({data.globalTopics.length})
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
                <li className="text-xs text-[var(--text-secondary)]">{t("search.noGlobal")}</li>
              )}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
