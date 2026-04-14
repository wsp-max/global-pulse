interface HotTopicTickerProps {
  items: string[];
}

export function HotTopicTicker({ items }: HotTopicTickerProps) {
  const fallback = ["데이터 수집 중 · 잠시 후 자동 갱신됩니다."];
  const tickerItems = items.length > 0 ? items : fallback;
  const shouldLoop = tickerItems.length > 1;
  const line = shouldLoop ? [...tickerItems, ...tickerItems].join("   |   ") : tickerItems[0];

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3">
      <div
        className={`${shouldLoop ? "animate-ticker" : ""} whitespace-nowrap text-sm text-[var(--text-secondary)]`}
      >
        {line}
      </div>
    </div>
  );
}
