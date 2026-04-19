"use client";

import type { DashboardScope } from "@/lib/types/api";

export interface DashboardFilters {
  category: string;
  period: "1h" | "6h" | "24h" | "7d";
  sentiment: "all" | "pos" | "neg" | "controversial";
  scope: DashboardScope;
  minZ: number;
  q: string;
}

interface FilterBarProps {
  value: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
}

export function FilterBar({ value, onChange }: FilterBarProps) {
  const update = <K extends keyof DashboardFilters>(key: K, next: DashboardFilters[K]) => {
    onChange({
      ...value,
      [key]: next,
    });
  };

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
      <div className="grid gap-2 md:grid-cols-6">
        <input
          value={value.q}
          onChange={(event) => update("q", event.target.value)}
          placeholder="토픽/엔티티 검색"
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)] md:col-span-2"
          aria-label="토픽 검색"
        />

        <select
          value={value.category}
          onChange={(event) => update("category", event.target.value)}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
          aria-label="카테고리"
        >
          <option value="all">카테고리 전체</option>
          <option value="politics">정치</option>
          <option value="economy">경제</option>
          <option value="tech">기술</option>
          <option value="society">사회</option>
          <option value="entertainment">엔터</option>
        </select>

        <select
          value={value.period}
          onChange={(event) => update("period", event.target.value as DashboardFilters["period"])}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
          aria-label="기간"
        >
          <option value="1h">1h</option>
          <option value="6h">6h</option>
          <option value="24h">24h</option>
          <option value="7d">7d</option>
        </select>

        <select
          value={value.sentiment}
          onChange={(event) => update("sentiment", event.target.value as DashboardFilters["sentiment"])}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
          aria-label="감성"
        >
          <option value="all">감성 전체</option>
          <option value="pos">긍정</option>
          <option value="neg">부정</option>
          <option value="controversial">논쟁</option>
        </select>

        <select
          value={value.scope}
          onChange={(event) => update("scope", event.target.value as DashboardFilters["scope"])}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
          aria-label="스코프"
        >
          <option value="community">community</option>
          <option value="news">news</option>
          <option value="mixed">mixed</option>
        </select>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span>minZ {value.minZ.toFixed(1)}</span>
        <input
          type="range"
          min={0}
          max={5}
          step={0.1}
          value={value.minZ}
          onChange={(event) => update("minZ", Number(event.target.value))}
          className="w-full"
          aria-label="최소 Z 스코어"
        />
      </div>
    </section>
  );
}
