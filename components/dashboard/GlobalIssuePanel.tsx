import Link from "next/link";
import { getRegionById, type GlobalTopic } from "@global-pulse/shared";

interface GlobalIssuePanelProps {
  topics: GlobalTopic[];
}

function toSentimentLabel(value: number): string {
  if (value <= -0.6) return "매우 부정";
  if (value <= -0.2) return "부정";
  if (value < 0.2) return "중립";
  if (value < 0.6) return "긍정";
  return "매우 긍정";
}

export function GlobalIssuePanel({ topics }: GlobalIssuePanelProps) {
  const rows = topics.slice(0, 8);

  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-base text-[var(--text-accent)]">GLOBAL ISSUES</h2>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
          아직 글로벌 토픽이 없습니다. `analyze-global` 실행 후 표시됩니다.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((topic) => {
            const sentimentEntries = Object.entries(topic.regionalSentiments);
            const primaryRegion =
              (topic.firstSeenRegion && getRegionById(topic.firstSeenRegion)) ||
              (topic.regions.length > 0 ? getRegionById(topic.regions[0]) : null);

            const card = (
              <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4 transition-colors hover:border-[var(--border-hover)]">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {topic.nameKo || topic.nameEn}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {topic.regions
                    .map((regionId) => {
                      const region = getRegionById(regionId);
                      return region ? `${region.flagEmoji} ${region.nameKo}` : regionId.toUpperCase();
                    })
                    .join(" · ")}
                </p>

                <div className="mt-3 space-y-1.5">
                  {sentimentEntries.slice(0, 3).map(([regionId, value]) => {
                    const region = getRegionById(regionId);
                    const width = Math.max(6, ((value + 1) / 2) * 100);
                    return (
                      <div key={`${topic.id}-${regionId}`} className="text-[11px]">
                        <div className="mb-1 flex items-center justify-between text-[var(--text-secondary)]">
                          <span>{region ? `${region.flagEmoji} ${region.nameKo}` : regionId}</span>
                          <span>{toSentimentLabel(value)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,var(--sentiment-negative),var(--sentiment-positive))]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 text-[11px] text-[var(--text-tertiary)]">
                  Heat {Math.round(topic.totalHeatScore)}
                  {primaryRegion ? ` · 최초 감지 ${primaryRegion.flagEmoji} ${primaryRegion.nameKo}` : ""}
                </div>
              </article>
            );

            if (typeof topic.id === "number") {
              return (
                <Link key={topic.id} href={`/topic/${topic.id}`}>
                  {card}
                </Link>
              );
            }

            return (
              <div key={topic.nameEn}>
                {card}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
