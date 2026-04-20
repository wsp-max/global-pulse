"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { DashboardScope } from "@/lib/types/api";
import { useLanguage } from "@/lib/i18n/use-language";

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
  rightSlot?: ReactNode;
}

export function FilterBar({ value, onChange, rightSlot }: FilterBarProps) {
  const { t } = useLanguage("ko");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = <K extends keyof DashboardFilters>(key: K, next: DashboardFilters[K]) => {
    onChange({
      ...value,
      [key]: next,
    });
  };

  return (
    <section className="card-panel p-3">
      <div className="grid gap-2 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_auto]">
        <input
          value={value.q}
          onChange={(event) => update("q", event.target.value)}
          placeholder={t("filter.searchPlaceholder")}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
          aria-label={t("filter.searchPlaceholder")}
        />

        <select
          value={value.category}
          onChange={(event) => update("category", event.target.value)}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
          aria-label={t("filter.categoryAll")}
        >
          <option value="all">{t("filter.categoryAll")}</option>
          <option value="politics">{t("filter.category.politics")}</option>
          <option value="economy">{t("filter.category.economy")}</option>
          <option value="tech">{t("filter.category.tech")}</option>
          <option value="society">{t("filter.category.society")}</option>
          <option value="entertainment">{t("filter.category.entertainment")}</option>
        </select>

        <select
          value={value.period}
          onChange={(event) => update("period", event.target.value as DashboardFilters["period"])}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
          aria-label="Period"
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
          aria-label={t("filter.sentiment.all")}
        >
          <option value="all">{t("filter.sentiment.all")}</option>
          <option value="pos">{t("filter.sentiment.pos")}</option>
          <option value="neg">{t("filter.sentiment.neg")}</option>
          <option value="controversial">{t("filter.sentiment.controversial")}</option>
        </select>

        <select
          value={value.scope}
          onChange={(event) => update("scope", event.target.value as DashboardFilters["scope"])}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
          aria-label="Scope"
        >
          <option value="community">{t("filter.scope.community")}</option>
          <option value="news">{t("filter.scope.news")}</option>
          <option value="mixed">{t("filter.scope.mixed")}</option>
        </select>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            aria-label="고급 필터 토글"
          >
            고급 필터
          </button>
          {rightSlot}
        </div>
      </div>

      {showAdvanced ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>
            {t("filter.minZ")} {value.minZ.toFixed(1)}
          </span>
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={value.minZ}
            onChange={(event) => update("minZ", Number(event.target.value))}
            className="w-full"
            aria-label={t("filter.minZ")}
          />
        </div>
      ) : null}
    </section>
  );
}
