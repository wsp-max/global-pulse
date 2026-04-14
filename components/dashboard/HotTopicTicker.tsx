interface HotTopicTickerProps {
  items: string[];
}

export function HotTopicTicker({ items }: HotTopicTickerProps) {
  const fallback = [
    "\uB370\uC774\uD130 \uC218\uC9D1 \uC911 \u00B7 \uC7A0\uC2DC \uD6C4 \uC790\uB3D9 \uAC31\uC2E0\uB429\uB2C8\uB2E4.",
  ];
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
