import type { CSSProperties } from "react";
import { useMemo } from "react";
import { getRegionById, type GlobalTopic } from "@global-pulse/shared";
import type { RegionDashboardRow } from "@/lib/types/api";

interface PropagationStreamProps {
  regions: RegionDashboardRow[];
  globalTopics: GlobalTopic[];
}

interface KeywordSignal {
  key: string;
  label: string;
  hits: number;
  color: string;
  lane: number;
  direction: "left" | "right";
  durationSec: number;
  delaySec: number;
}

interface PropagationLane {
  key: string;
  label: string;
  heat: number;
  regionIds: string[];
}

function normalizeKeyword(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function isMeaningfulKeyword(keyword: string): boolean {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return false;
  if (normalized.length < 2) return false;
  if (/^[0-9]+$/.test(normalized)) return false;
  return true;
}

function getKeywordSignals(regions: RegionDashboardRow[]): KeywordSignal[] {
  const signals = new Map<string, { hits: number; regionColor: string }>();

  for (const region of regions) {
    for (const keyword of region.topKeywords.slice(0, 7)) {
      const normalized = normalizeKeyword(keyword);
      if (!isMeaningfulKeyword(normalized)) {
        continue;
      }
      const existing = signals.get(normalized);
      if (existing) {
        existing.hits += 1;
      } else {
        signals.set(normalized, { hits: 1, regionColor: region.color });
      }
    }
  }

  return [...signals.entries()]
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 18)
    .map(([label, meta], index) => ({
      key: `${label}-${index}`,
      label,
      hits: meta.hits,
      color: meta.regionColor,
      lane: ((index * 17) % 78) + 6,
      direction: index % 2 === 0 ? "left" : "right",
      durationSec: 13 + (index % 5) * 1.5,
      delaySec: index * 0.45,
    }));
}

function getPropagationLanes(regions: RegionDashboardRow[], globalTopics: GlobalTopic[]): PropagationLane[] {
  const topicLanes = globalTopics.slice(0, 4).map((topic) => {
    const ordered = new Set<string>();
    if (topic.firstSeenRegion) {
      ordered.add(topic.firstSeenRegion);
    }
    for (const regionId of topic.regions) {
      ordered.add(regionId);
    }

    return {
      key: `global-${topic.id ?? topic.nameEn}`,
      label: topic.nameKo || topic.nameEn,
      heat: topic.totalHeatScore,
      regionIds: [...ordered].slice(0, 5),
    };
  });

  if (topicLanes.length > 0) {
    return topicLanes;
  }

  const fallbackRegions = [...regions]
    .sort((a, b) => b.totalHeatScore - a.totalHeatScore)
    .slice(0, 4)
    .map((region) => region.id);

  if (fallbackRegions.length === 0) {
    return [];
  }

  return [
    {
      key: "regional-heat-wave",
      label: "Regional Heat Wave",
      heat: regions.reduce((sum, region) => sum + region.totalHeatScore, 0),
      regionIds: fallbackRegions,
    },
  ];
}

export function PropagationStream({ regions, globalTopics }: PropagationStreamProps) {
  const keywordSignals = useMemo(() => getKeywordSignals(regions), [regions]);
  const propagationLanes = useMemo(() => getPropagationLanes(regions, globalTopics), [regions, globalTopics]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(11,24,39,0.88),rgba(10,14,23,0.98))] p-4 shadow-[var(--shadow-card)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(56,189,248,0.16),transparent_40%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-sm tracking-[0.22em] text-[var(--text-accent)]">SIGNAL PROPAGATION</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Keyword motion and cross-region spread in one live stream.
            </p>
          </div>
          <span className="rounded-full border border-[var(--border-default)] bg-[rgba(15,23,42,0.7)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
            Live Signals {keywordSignals.length}
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="relative min-h-[180px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[rgba(15,23,42,0.72)] px-2 py-1">
            <div className="pointer-events-none absolute inset-0 panel-grid opacity-50" />
            {keywordSignals.length === 0 ? (
              <div className="flex h-full items-center justify-center px-3 text-xs text-[var(--text-secondary)]">
                Keyword stream is warming up from the latest region data.
              </div>
            ) : (
              keywordSignals.map((signal) => {
                const style = {
                  top: `${signal.lane}%`,
                  color: signal.color,
                  borderColor: `${signal.color}55`,
                  ["--stream-duration" as string]: `${signal.durationSec}s`,
                  ["--stream-delay" as string]: `${signal.delaySec}s`,
                } as CSSProperties;

                return (
                  <span
                    key={signal.key}
                    className={`keyword-stream-word ${signal.direction === "left" ? "keyword-stream-word--left" : "keyword-stream-word--right"} rounded-full border bg-[rgba(15,23,42,0.75)] px-2 py-0.5 font-mono text-[11px] whitespace-nowrap`}
                    style={style}
                  >
                    {signal.label}
                    <span className="ml-1 text-[var(--text-accent)]">x{signal.hits}</span>
                  </span>
                );
              })
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[rgba(15,23,42,0.72)] p-3">
            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-accent)]">SPREAD TRACK</p>
            {propagationLanes.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">Propagation lanes will appear after data collection.</p>
            ) : (
              propagationLanes.map((lane, index) => {
                const dotStyle = {
                  ["--dot-duration" as string]: `${4.2 + index * 1.1}s`,
                  ["--dot-delay" as string]: `${index * 0.4}s`,
                } as CSSProperties;

                return (
                  <article key={lane.key} className="rounded-lg border border-[var(--border-default)] bg-[rgba(10,14,23,0.76)] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-[var(--text-primary)]">{lane.label}</p>
                      <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{Math.round(lane.heat)}</span>
                    </div>

                    <div className="relative mt-2 h-2 overflow-hidden rounded-full border border-[var(--border-default)] bg-[rgba(51,65,85,0.42)]">
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(56,189,248,0.08),rgba(239,68,68,0.34),rgba(52,211,153,0.08))]" />
                      <span className="propagation-dot" style={dotStyle} />
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] text-[var(--text-secondary)]">
                      {lane.regionIds.map((regionId, regionIndex) => {
                        const region = getRegionById(regionId);
                        const label = region ? `${region.flagEmoji} ${region.nameKo}` : regionId.toUpperCase();

                        return (
                          <span
                            key={`${lane.key}-${regionId}`}
                            className="flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--border-default)] bg-[rgba(30,41,59,0.65)] px-2 py-0.5"
                          >
                            {label}
                            {regionIndex < lane.regionIds.length - 1 && (
                              <span className="text-[var(--text-tertiary)]">-&gt;</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
