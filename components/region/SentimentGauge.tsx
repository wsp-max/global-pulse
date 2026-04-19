interface SentimentGaugeProps {
  value: number | null;
}

export function SentimentGauge({ value }: SentimentGaugeProps) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  const percent = safeValue === null ? 50 : Math.max(0, Math.min(100, ((safeValue + 1) / 2) * 100));

  return (
    <div className="space-y-2">
      <div className="h-2 rounded-full bg-[linear-gradient(to_right,var(--sentiment-negative),var(--sentiment-neutral),var(--sentiment-positive))]" />
      <div className="relative h-1 rounded-full bg-[var(--bg-tertiary)]">
        <span
          className="absolute -top-1 h-3 w-3 rounded-full border border-[var(--border-default)] bg-white"
          style={{ left: `calc(${percent}% - 6px)` }}
        />
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Sentiment: {safeValue === null ? "N/A" : safeValue.toFixed(1)}
      </p>
    </div>
  );
}
