"use client";

import { useState } from "react";
import type { WatchlistItem } from "@/lib/hooks/useWatchlist";

interface WatchBellProps {
  items: WatchlistItem[];
  alertCount: number;
  onClearAlerts: () => void;
  onRequestNotification: () => Promise<NotificationPermission | "unsupported">;
  onTopicSelect?: (topicId: number) => void;
}

function lifecycleBadge(stage: string | null): string {
  if (stage === "peaking") {
    return "⚡ peaking";
  }
  if (stage === "fading") {
    return "↘ fading";
  }
  return "emerging";
}

export function WatchBell({
  items,
  alertCount,
  onClearAlerts,
  onRequestNotification,
  onTopicSelect,
}: WatchBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="워치리스트 열기"
        onClick={() => {
          setOpen((previous) => !previous);
          if (alertCount > 0) {
            onClearAlerts();
          }
        }}
        className="relative rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
      >
        🔔 Watchlist
        {alertCount > 0 ? (
          <span className="ml-1 rounded-full border border-red-500/40 bg-red-500/10 px-1.5 text-[10px] text-red-300">
            {alertCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="absolute right-0 z-[90] mt-2 w-[320px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Watched Topics</p>
            <button
              type="button"
              className="rounded border border-[var(--border-default)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
              onClick={async () => {
                await onRequestNotification();
              }}
            >
              브라우저 알림 허용
            </button>
          </div>

          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)]">관심 토픽이 없습니다.</p>
            ) : (
              items.map((item) => (
                <button
                  key={`watch-${item.topicId}`}
                  type="button"
                  onClick={() => {
                    onTopicSelect?.(item.topicId);
                    setOpen(false);
                  }}
                  className="block w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-2 text-left hover:border-[var(--border-hover)]"
                >
                  <p className="truncate text-xs text-[var(--text-primary)]">{item.name}</p>
                  <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                    {item.regionId.toUpperCase()} · heat {Math.round(item.heatScore)} · {lifecycleBadge(item.lifecycleStage)}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
