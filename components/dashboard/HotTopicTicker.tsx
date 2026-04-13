interface HotTopicTickerProps {
  items: string[];
}

export function HotTopicTicker({ items }: HotTopicTickerProps) {
  const fallback = ["데이터 수집 중 · 잠시 후 자동 갱신됩니다"];
  const tickerItems = items.length > 0 ? items : fallback;
  const line = [...tickerItems, ...tickerItems].join("   |   ");

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3">
      <div className="animate-ticker whitespace-nowrap text-sm text-[var(--text-secondary)]">{line}</div>
    </div>
  );
}
