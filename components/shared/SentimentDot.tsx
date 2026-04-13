export function SentimentDot({ sentiment }: { sentiment: number }) {
  const color = sentiment > 0.1 ? "var(--sentiment-positive)" : sentiment < -0.1 ? "var(--sentiment-negative)" : "var(--sentiment-neutral)";

  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />;
}


