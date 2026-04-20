"use client";

import { useLanguage } from "@/lib/i18n/use-language";

interface LivePulseStripProps {
  items: string[];
}

export function LivePulseStrip({ items }: LivePulseStripProps) {
  const { t } = useLanguage("ko");
  const fallback = `${t("dashboard.status.collecting")} · ${t("dashboard.error.globalRetry")}.`;
  const line = items.length > 0 ? items.join("   |   ") : fallback;

  return (
    <div className="flex max-h-10 items-center gap-3 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2">
      <div className="inline-flex shrink-0 items-center gap-2 text-[11px] text-[var(--text-secondary)]">
        <span className="inline-block h-2 w-2 animate-pulseBeat rounded-full bg-[var(--sentiment-positive)]" />
        LIVE
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="animate-ticker whitespace-nowrap text-xs text-[var(--text-secondary)]">{line}</p>
      </div>
    </div>
  );
}
