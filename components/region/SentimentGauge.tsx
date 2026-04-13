export function SentimentGauge({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, ((value + 1) / 2) * 100));

  return (
    <div className="space-y-2">
      <div className="h-2 rounded-full bg-[linear-gradient(to_right,var(--sentiment-negative),var(--sentiment-neutral),var(--sentiment-positive))]" />
      <div className="relative h-1 rounded-full bg-[var(--bg-tertiary)]">
        <span className="absolute -top-1 h-3 w-3 rounded-full border border-[var(--border-default)] bg-white" style={{ left: `calc(${percent}% - 6px)` }} />
      </div>
      <p className="text-xs text-[var(--text-secondary)]">Sentiment: {value.toFixed(1)}</p>
    </div>
  );
}


