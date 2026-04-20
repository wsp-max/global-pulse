"use client";

import type { DashboardScope } from "@/lib/types/api";

interface ScopeTabsProps {
  value: DashboardScope;
  onChange: (scope: DashboardScope) => void;
}

const TABS: Array<{ id: DashboardScope; label: string; hint: string; icon: string }> = [
  { id: "community", label: "Community", hint: "Reddit · 디시 · 5ch 등 유저 반응", icon: "🗣" },
  { id: "news", label: "News", hint: "공식 뉴스·포털 기사 기반", icon: "📰" },
];

export function ScopeTabs({ value, onChange }: ScopeTabsProps) {
  return (
    <div role="tablist" aria-label="데이터 소스 범위" className="card-panel flex gap-1 p-1">
      {TABS.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-lg px-4 py-3 text-left transition ${
              active
                ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-inner"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden>{tab.icon}</span>
              {tab.label}
            </span>
            <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">{tab.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
