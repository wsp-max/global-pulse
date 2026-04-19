import type { GlobalTopic } from "@global-pulse/shared";
import type { RegionDashboardRow } from "@/lib/types/api";
import { toHeatBand, toHeatPercent } from "@/lib/utils/heat";
import { cleanupTopicName } from "@/lib/utils/topic-name";

interface PulseSignalBoardProps {
  regions: RegionDashboardRow[];
  globalTopics: GlobalTopic[];
}

function toSentimentLabel(value: number): string {
  if (value <= -0.5) return "Negative";
  if (value < 0.2) return "Neutral";
  return "Positive";
}

function sentimentAccent(value: number): string {
  if (value <= -0.2) return "var(--sentiment-negative)";
  if (value >= 0.2) return "var(--sentiment-positive)";
  return "var(--sentiment-neutral)";
}

function topicDisplayBand(topic: GlobalTopic, maxHeat: number): number {
  if (typeof topic.heatScoreDisplay === "number" && Number.isFinite(topic.heatScoreDisplay)) {
    return Math.max(0, Math.min(1, topic.heatScoreDisplay));
  }
  return toHeatBand(topic.totalHeatScore, maxHeat);
}

export function PulseSignalBoard({ regions, globalTopics }: PulseSignalBoardProps) {
  const totalHeat = regions.reduce((sum, region) => sum + region.totalHeatScore, 0);
  const totalActiveTopics = regions.reduce((sum, region) => sum + region.activeTopics, 0);
  const totalSources = regions.reduce((sum, region) => sum + region.sourcesTotal, 0);
  const totalActiveSources = regions.reduce((sum, region) => sum + region.sourcesActive, 0);

  const weightedSentiment = regions.reduce((sum, region) => {
    const weight = Math.max(region.activeTopics, 1);
    return sum + region.avgSentiment * weight;
  }, 0);
  const sentimentWeight = regions.reduce((sum, region) => sum + Math.max(region.activeTopics, 1), 0);
  const averageSentiment = sentimentWeight > 0 ? weightedSentiment / sentimentWeight : 0;

  const maxHeat = Math.max(...regions.map((region) => region.totalHeatScore), 1);
  const hottestRegions = [...regions].sort((a, b) => b.totalHeatScore - a.totalHeatScore).slice(0, 6);
  const leadGlobal = globalTopics[0] ?? null;
  const leadGlobalRegionText =
    leadGlobal?.regions.slice(0, 6).map((regionId) => regionId.toUpperCase()).join(" -> ") ?? "";

  const accelerating = [...globalTopics]
    .filter((topic) => (topic.acceleration ?? 0) > 0)
    .sort((a, b) => (b.acceleration ?? 0) - (a.acceleration ?? 0))
    .slice(0, 3);

  const keywordCounts = new Map<string, number>();
  for (const region of regions) {
    for (const keyword of region.topKeywords.slice(0, 12)) {
      const normalized = keyword.trim();
      if (!normalized) {
        continue;
      }
      keywordCounts.set(normalized, (keywordCounts.get(normalized) ?? 0) + 1);
    }
  }
  const keywordRows = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16);

  return (
    <section className="panel-grid relative h-full overflow-hidden rounded-xl border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(7,23,45,0.86),rgba(10,14,23,0.98))] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.12),transparent_45%)]" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-sm tracking-[0.2em] text-[var(--text-accent)]">SIGNAL BOARD</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Global synchronized signal snapshot.</p>
          </div>
          <div
            className="rounded-full border px-2 py-1 text-[11px] font-semibold"
            style={{
              borderColor: sentimentAccent(averageSentiment),
              color: sentimentAccent(averageSentiment),
            }}
          >
            Sentiment {averageSentiment.toFixed(2)} / {toSentimentLabel(averageSentiment)}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-[var(--border-default)] bg-[rgba(15,23,42,0.75)] p-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Total Heat</p>
            <p className="mt-1 font-display text-lg text-[var(--text-primary)]">{Math.round(totalHeat)}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[rgba(15,23,42,0.75)] p-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Active Topics</p>
            <p className="mt-1 font-display text-lg text-[var(--text-primary)]">{totalActiveTopics}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[rgba(15,23,42,0.75)] p-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Source Health</p>
            <p className="mt-1 font-display text-lg text-[var(--text-primary)]">
              {totalActiveSources}/{totalSources}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[rgba(15,23,42,0.75)] p-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Global Topics</p>
            <p className="mt-1 font-display text-lg text-[var(--text-primary)]">{globalTopics.length}</p>
          </div>
        </div>

        <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border border-[var(--border-default)] bg-[rgba(15,23,42,0.72)] p-3">
            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-accent)]">REGION MOMENTUM</p>
            <div className="mt-3 space-y-3">
              {hottestRegions.map((region) => {
                const width = toHeatPercent(region.totalHeatScore, maxHeat, 12);
                const band = toHeatBand(region.totalHeatScore, maxHeat);

                return (
                  <div key={region.id}>
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <span className="truncate">
                        {region.flagEmoji} {region.nameKo}
                      </span>
                      <span className="font-mono text-[var(--text-primary)]">
                        {Math.round(region.totalHeatScore)} ({Math.round(band * 100)}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${width}%`,
                          background: `linear-gradient(90deg, ${region.color}, var(--text-accent))`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border-default)] bg-[rgba(15,23,42,0.72)] p-3">
              <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-accent)]">CROSS SIGNALS</p>
              {leadGlobal ? (
                <div className="mt-2 rounded-lg border border-[var(--border-default)] bg-[rgba(10,14,23,0.8)] p-2.5">
                  <p className="text-xs text-[var(--text-primary)]">
                    {cleanupTopicName({
                      id: leadGlobal.id,
                      nameKo: leadGlobal.nameKo,
                      nameEn: leadGlobal.nameEn,
                      keywords: [],
                      entities: null,
                    }).displayKo}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {leadGlobalRegionText || "region mapping pending"} / Heat {Math.round(leadGlobal.totalHeatScore)}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-[var(--text-secondary)]">Global signal data is not ready yet.</p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {keywordRows.length === 0 ? (
                  <span className="text-[11px] text-[var(--text-secondary)]">Collecting keyword signals...</span>
                ) : (
                  keywordRows.map(([keyword, hits]) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-[var(--border-default)] bg-[rgba(30,41,59,0.7)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
                    >
                      {keyword}
                      <span className="ml-1 text-[var(--text-accent)]">x{hits}</span>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-default)] bg-[rgba(15,23,42,0.72)] p-3">
              <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-accent)]">ACCELERATING NOW</p>
              {accelerating.length === 0 ? (
                <p className="mt-2 text-[11px] text-[var(--text-secondary)]">No accelerating topic in this batch.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {accelerating.map((topic) => {
                    const cleaned = cleanupTopicName({
                      id: topic.id,
                      nameKo: topic.nameKo,
                      nameEn: topic.nameEn,
                      keywords: [],
                      entities: null,
                    });
                    const band = topicDisplayBand(topic, Math.max(1, globalTopics[0]?.totalHeatScore ?? 1));
                    return (
                      <div
                        key={`accel-${topic.id ?? topic.nameEn}`}
                        className="rounded-lg border border-[var(--border-default)] bg-[rgba(10,14,23,0.8)] p-2"
                      >
                        <p className="truncate text-xs text-[var(--text-primary)]">
                          {cleaned.displayKo}
                          {cleaned.isFallback && (
                            <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                              이름 정제 중
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                          velocity {Number(topic.velocityPerHour ?? 0).toFixed(1)} / accel {Number(topic.acceleration ?? 0).toFixed(1)} / heat-band {Math.round(band * 100)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
