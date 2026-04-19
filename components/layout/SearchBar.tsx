"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { SearchApiResponse } from "@/lib/types/api";
import { useLanguage } from "@/lib/i18n/use-language";
import { fetcher } from "@/lib/api";

interface SearchSuggestion {
  id?: number;
  regionId: string;
  nameKo: string;
  nameEn: string;
}

function useDebouncedValue(value: string, delayMs = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SearchBar() {
  const router = useRouter();
  const { t } = useLanguage("ko");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounced = useDebouncedValue(query.trim(), 260);

  const endpoint = useMemo(() => {
    if (!debounced) {
      return null;
    }
    return `/search?q=${encodeURIComponent(debounced)}`;
  }, [debounced]);

  const { data, isLoading: loading } = useSWR<SearchApiResponse>(endpoint, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const suggestions: SearchSuggestion[] = useMemo(() => {
    if (!data?.topics) {
      return [];
    }
    return data.topics.slice(0, 6).map((topic) => ({
      id: topic.id,
      regionId: topic.regionId,
      nameKo: topic.nameKo,
      nameEn: topic.nameEn,
    }));
  }, [data]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName ?? "").toLowerCase();
      const isTypingContext = ["input", "textarea", "select"].includes(activeTag);
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingContext) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(event.target as Node)) return;
      setOpen(false);
      setActiveIndex(-1);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const openSearchPage = () => {
    if (!query.trim()) {
      return;
    }
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
    setActiveIndex(-1);
  };

  const openTopic = (suggestion: SearchSuggestion) => {
    if (!suggestion.id) {
      openSearchPage();
      return;
    }
    router.push(`/topic/${suggestion.id}`);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={wrapperRef} className="relative hidden w-full max-w-[320px] md:block">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1">
        <Search size={14} className="text-[var(--text-tertiary)]" />
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (activeIndex >= 0 && suggestions[activeIndex]) {
                openTopic(suggestions[activeIndex]!);
                return;
              }
              openSearchPage();
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (suggestions.length === 0) return;
              setActiveIndex((prev) => (prev + 1) % suggestions.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (suggestions.length === 0) return;
              setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
              return;
            }
            if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="w-full bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        <button
          type="button"
          onClick={openSearchPage}
          className="rounded border border-[var(--border-default)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)]"
          aria-label={t("header.searchAria")}
        >
          /
        </button>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 shadow-xl">
          {loading ? (
            <p className="px-2 py-1 text-[11px] text-[var(--text-tertiary)]">{t("header.searchSearching")}</p>
          ) : suggestions.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-[var(--text-tertiary)]">{t("header.searchNoResults")}</p>
          ) : (
            <ul className="space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion.regionId}-${suggestion.id ?? suggestion.nameEn}-${index}`}>
                  <button
                    type="button"
                    onClick={() => openTopic(suggestion)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs transition ${
                      activeIndex === index
                        ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                    }`}
                    aria-label={`Open topic ${suggestion.nameKo || suggestion.nameEn}`}
                  >
                    <span className="truncate pr-2">{suggestion.nameKo || suggestion.nameEn}</span>
                    <span className="font-mono text-[10px] uppercase text-[var(--text-tertiary)]">{suggestion.regionId}</span>
                  </button>
                </li>
              ))}
              {query.trim() ? (
                <li>
                  <Link
                    href={`/search?q=${encodeURIComponent(query.trim())}`}
                    onClick={() => {
                      setOpen(false);
                      setActiveIndex(-1);
                    }}
                    className="mt-1 block rounded-md border border-[var(--border-default)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    {t("header.searchOpenFull")}
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
