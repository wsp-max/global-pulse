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

const REGION_LONGITUDE: Record<string, number> = {
  kr: 127.8,
  jp: 138.3,
  tw: 121.0,
  cn: 104.2,
  us: -98.6,
  eu: 10.0,
  me: 45.0,
  ru: 90.0,
};

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

function resolveSignalDirection(originRegionId: string, regionIds: Set<string>): "left" | "right" {
  const originLon = REGION_LONGITUDE[originRegionId];
  if (originLon === undefined) {
    return "right";
  }

  const targetLons = [...regionIds]
    .filter((regionId) => regionId !== originRegionId)
    .map((regionId) => REGION_LONGITUDE[regionId])
    .filter((value): value is number => Number.isFinite(value));

  if (targetLons.length === 0) {
    return "right";
  }

  const avgTargetLon = targetLons.reduce((sum, value) => sum + value, 0) / targetLons.length;
  return avgTargetLon >= originLon ? "right" : "left";
}

function getKeywordSignals(regions: RegionDashboardRow[], globalTopics: GlobalTopic[]): KeywordSignal[] {
  const regionColorMap = new Map(regions.map((region) => [region.id, region.color]));
  const regionHeatMap = new Map(regions.map((region) => [region.id, region.totalHeatScore]));
  const signals = new Map<
    string,
    {
      regionIds: Set<string>;
      heat: number;
      regionColor: string;
      originRegionId: string;
    }
  >();

  for (const topic of globalTopics.slice(0, 24)) {
    if (topic.regions.length < 2) {
      continue;
    }

    const label = normalizeKeyword(topic.nameKo || topic.nameEn);
    if (!isMeaningfulKeyword(label)) {
      continue;
    }

    const leadRegionId = topic.firstSeenRegion ?? topic.regions[0];
    const leadColor = regionColorMap.get(leadRegionId) ?? "var(--text-accent)";
    const existing = signals.get(label);
    if (existing) {
      topic.regions.forEach((regionId) => existing.regionIds.add(regionId));
      existing.heat += topic.totalHeatScore;
      if (topic.firstSeenRegion) {
        existing.originRegionId = topic.firstSeenRegion;
      }
    } else {
      signals.set(label, {
        regionIds: new Set(topic.regions),
        heat: topic.totalHeatScore,
        regionColor: leadColor,
        originRegionId: leadRegionId,
      });
    }
  }

  for (const region of regions) {
    for (const keyword of region.topKeywords.slice(0, 14)) {
      const normalizedKeyword = normalizeKeyword(keyword);
      if (!isMeaningfulKeyword(normalizedKeyword)) {
        continue;
      }

      const existing = signals.get(normalizedKeyword);
      if (existing) {
        existing.regionIds.add(region.id);
        existing.heat += Math.max(region.totalHeatScore * 0.08, 30);

        const currentOriginHeat = regionHeatMap.get(existing.originRegionId) ?? 0;
        if (region.totalHeatScore > currentOriginHeat) {
          existing.originRegionId = region.id;
          existing.regionColor = region.color;
        }
      } else {
        signals.set(normalizedKeyword, {
          regionIds: new Set([region.id]),
          heat: Math.max(region.totalHeatScore * 0.08, 30),
          regionColor: region.color,
          originRegionId: region.id,
        });
      }
    }
  }

  return [...signals.entries()]
    .filter(([, meta]) => meta.regionIds.size >= 2)
    .sort((a, b) => {
      if (b[1].regionIds.size !== a[1].regionIds.size) {
        return b[1].regionIds.size - a[1].regionIds.size;
      }
      return b[1].heat - a[1].heat;
    })
    .slice(0, 40)
    .map(([label, meta], index) => ({
      key: `${label}-${index}`,
      label,
      hits: meta.regionIds.size,
      color: meta.regionColor,
      lane: ((index * 17) % 78) + 6,
      direction: resolveSignalDirection(meta.originRegionId, meta.regionIds),
      durationSec: 12 + (index % 6) * 1.4,
      delaySec: index * 0.3,
    }));
}

function getPropagationLanes(globalTopics: GlobalTopic[]): PropagationLane[] {
  return globalTopics
    .filter((topic) => topic.regions.length >= 2)
    .slice(0, 8)
    .map((topic) => {
      const origin = topic.firstSeenRegion ?? topic.regions[0];
      const tail = topic.regions
        .filter((regionId) => regionId !== origin)
        .sort((a, b) => (topic.regionalHeatScores[b] ?? 0) - (topic.regionalHeatScores[a] ?? 0));
      const ordered = [origin, ...tail];

      return {
        key: `global-${topic.id ?? topic.nameEn}`,
        label: topic.nameKo || topic.nameEn,
        heat: topic.totalHeatScore,
        regionIds: [...ordered].slice(0, 5),
      };
    })
    .filter((lane) => lane.regionIds.length >= 2);
}

export function PropagationStream({ regions, globalTopics }: PropagationStreamProps) {
  const keywordSignals = useMemo(() => getKeywordSignals(regions, globalTopics), [regions, globalTopics]);
  const propagationLanes = useMemo(() => getPropagationLanes(globalTopics), [globalTopics]);
  const hasActualMovement = keywordSignals.length > 0 || propagationLanes.length > 0;

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
            {hasActualMovement ? `Live Signals ${keywordSignals.length}` : "No Active Propagation"}
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="relative min-h-[180px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[rgba(15,23,42,0.72)] px-2 py-1">
            <div className="pointer-events-none absolute inset-0 panel-grid opacity-50" />
            {keywordSignals.length === 0 ? (
              <div className="flex h-full items-center justify-center px-3 text-xs text-[var(--text-secondary)]">
                No shared cross-region keyword movement detected in the current batch.
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
