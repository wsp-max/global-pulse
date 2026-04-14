import { getRegionById } from "@global-pulse/shared";

interface CrossRegionComparisonProps {
  sentiments: Record<string, number>;
  heatScores: Record<string, number>;
}

function getSentimentLabel(sentiment: number): string {
  if (sentiment <= -0.6) return "매우 부정";
  if (sentiment <= -0.2) return "부정";
  if (sentiment < 0.2) return "중립";
  if (sentiment < 0.6) return "긍정";
  return "매우 긍정";
}

function getSentimentColor(sentiment: number): string {
  if (sentiment <= -0.2) return "var(--sentiment-negative)";
  if (sentiment >= 0.2) return "var(--sentiment-positive)";
  return "var(--sentiment-neutral)";
}

interface ComparisonRow {
  regionId: string;
  sentiment: number;
  heatScore: number;
}

export function CrossRegionComparison({ sentiments, heatScores }: CrossRegionComparisonProps) {
  const regionIds = [...new Set([...Object.keys(sentiments), ...Object.keys(heatScores)])];

  const rows: ComparisonRow[] = regionIds
    .map((regionId) => ({
      regionId,
      sentiment: sentiments[regionId] ?? 0,
      heatScore: heatScores[regionId] ?? 0,
    }))
    .sort((a, b) => b.heatScore - a.heatScore);

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <h2 className="text-sm font-semibold">리전별 반응 비교</h2>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">비교 가능한 리전 데이터가 없습니다.</p>
      </section>
    );
  }

  const maxHeat = Math.max(...rows.map((row) => row.heatScore), 1);

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
      <h2 className="text-sm font-semibold">리전별 반응 비교</h2>
      <div className="mt-3 space-y-3">
        {rows.map((row) => {
          const region = getRegionById(row.regionId);
          const sentimentPercent = Math.max(0, Math.min(100, ((row.sentiment + 1) / 2) * 100));
          const heatWidth = Math.max(8, (row.heatScore / maxHeat) * 100);
          const sentimentColor = getSentimentColor(row.sentiment);

          return (
            <article key={row.regionId} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--text-primary)]">
                  {region?.flagEmoji ?? "🌐"} {region?.nameKo ?? row.regionId.toUpperCase()}
                </span>
                <span className="text-[var(--text-tertiary)]">Heat {Math.round(row.heatScore)}</span>
              </div>

              <div className="relative h-2 rounded-full bg-[linear-gradient(to_right,var(--sentiment-negative),var(--sentiment-neutral),var(--sentiment-positive))]">
                <span
                  className="absolute -top-1 h-4 w-1 rounded-full"
                  style={{
                    left: `calc(${sentimentPercent}% - 2px)`,
                    backgroundColor: sentimentColor,
                    boxShadow: "0 0 10px rgba(255,255,255,0.25)",
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>
                  Sentiment {row.sentiment.toFixed(1)} ({getSentimentLabel(row.sentiment)})
                </span>
                <span>{region?.nameEn ?? row.regionId.toUpperCase()}</span>
              </div>

              <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-tertiary)]">
                <div className="h-full rounded-full bg-[var(--text-accent)]" style={{ width: `${heatWidth}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

