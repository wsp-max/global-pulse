"use client";

import type { CSSProperties } from "react";
import type { GlobalTopic } from "@global-pulse/shared";
import { ComposableMap, Geographies, Geography, Line, Marker } from "react-simple-maps";
import type { RegionDashboardRow } from "@/lib/types/api";

interface WorldHeatMapProps {
  regions: RegionDashboardRow[];
  globalTopics?: GlobalTopic[];
}

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const REGION_COORDINATES: Record<string, [number, number]> = {
  kr: [127.8, 36.3],
  jp: [138.3, 36.2],
  tw: [121.0, 23.7],
  cn: [104.2, 35.9],
  us: [-98.6, 39.8],
  eu: [10.0, 51.2],
  me: [45.0, 24.0],
  ru: [90.0, 61.0],
};

function getHeatColor(score: number): string {
  if (score < 100) return "var(--heat-cold)";
  if (score < 300) return "var(--heat-warm)";
  if (score < 600) return "var(--heat-hot)";
  if (score < 1000) return "var(--heat-fire)";
  return "var(--heat-explosive)";
}

function getFlowPairs(globalTopics: GlobalTopic[]): Array<[string, string]> {
  const directedScore = new Map<string, number>();
  const directedCount = new Map<string, number>();

  for (const topic of globalTopics.slice(0, 24)) {
    if (topic.regions.length < 2) {
      continue;
    }

    const origin = topic.firstSeenRegion && REGION_COORDINATES[topic.firstSeenRegion]
      ? topic.firstSeenRegion
      : topic.regions.find((regionId) => REGION_COORDINATES[regionId]);
    if (!origin) {
      continue;
    }

    const destinations = topic.regions
      .filter((regionId) => regionId !== origin)
      .filter((regionId) => REGION_COORDINATES[regionId]);
    if (destinations.length === 0) {
      continue;
    }

    for (const to of destinations) {
      const edgeKey = `${origin}__${to}`;
      directedScore.set(edgeKey, (directedScore.get(edgeKey) ?? 0) + topic.totalHeatScore);
      directedCount.set(edgeKey, (directedCount.get(edgeKey) ?? 0) + 1);
    }
  }

  const bestByUndirected = new Map<
    string,
    {
      from: string;
      to: string;
      score: number;
    }
  >();

  for (const [edgeKey, score] of directedScore.entries()) {
    const [from, to] = edgeKey.split("__");
    if (!from || !to) {
      continue;
    }

    const directionalVotes = directedCount.get(edgeKey) ?? 0;
    const stableScore = score + directionalVotes * 80;
    const undirectedKey = [from, to].sort().join("__");
    const current = bestByUndirected.get(undirectedKey);

    if (!current || stableScore > current.score) {
      bestByUndirected.set(undirectedKey, { from, to, score: stableScore });
    }
  }

  return [...bestByUndirected.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 16)
    .map((edge) => [edge.from, edge.to]);
}

export function WorldHeatMap({ regions, globalTopics = [] }: WorldHeatMapProps) {
  const maxHeat = Math.max(...regions.map((region) => region.totalHeatScore), 1);
  const flowPairs = getFlowPairs(globalTopics);
  const activeFlowRegionIds = new Set(flowPairs.flat());

  return (
    <div className="panel-grid relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14),transparent_50%)]" />
      <div className="relative">
        <p className="font-display text-lg text-[var(--text-accent)]">WORLD HEAT MAP</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Regional heat and cross-region signal routes.</p>

        <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2">
          <div className="relative h-[220px] sm:h-[300px]">
            <ComposableMap projectionConfig={{ scale: 145 }} style={{ width: "100%", height: "100%" }}>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#0f172a"
                      stroke="#334155"
                      strokeWidth={0.45}
                    />
                  ))
                }
              </Geographies>

              {flowPairs.map(([from, to], index) => {
                const fromCoord = REGION_COORDINATES[from];
                const toCoord = REGION_COORDINATES[to];
                if (!fromCoord || !toCoord) {
                  return null;
                }

                const lineStyle = {
                  ["--map-flow-duration" as string]: `${4 + index * 1.2}s`,
                } as CSSProperties;

                return (
                  <Line
                    key={`${from}-${to}-${index}`}
                    from={fromCoord}
                    to={toCoord}
                    stroke="rgba(56,189,248,0.85)"
                    strokeWidth={1.35}
                    fill="none"
                    className="map-flow-line"
                    style={lineStyle}
                  />
                );
              })}

              {flowPairs.map(([, to], index) => {
                const coordinates = REGION_COORDINATES[to];
                if (!coordinates) {
                  return null;
                }

                const dotStyle = {
                  ["--map-flow-dot-delay" as string]: `${index * 0.35}s`,
                  ["--map-flow-dot-duration" as string]: `${3.2 + index * 0.9}s`,
                } as CSSProperties;

                return (
                  <Marker key={`flow-dot-${to}-${index}`} coordinates={coordinates}>
                    <circle r={1.4} className="map-flow-dot" style={dotStyle} />
                  </Marker>
                );
              })}

              {regions.map((region) => {
                const coordinates = REGION_COORDINATES[region.id];
                if (!coordinates) {
                  return null;
                }

                const ratio = Math.max(0.06, region.totalHeatScore / maxHeat);
                const radius = 6 + ratio * 20;
                const color = getHeatColor(region.totalHeatScore);

                return (
                  <Marker key={region.id} coordinates={coordinates}>
                    <circle r={radius} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={1.2} />
                    <circle r={2.6} fill={color} className={activeFlowRegionIds.has(region.id) ? "map-node-pulse" : ""} />
                    <text y={-radius - 4} textAnchor="middle" className="fill-slate-200 text-[10px] font-medium">
                      {region.flagEmoji} {Math.round(region.totalHeatScore)}
                    </text>
                  </Marker>
                );
              })}
            </ComposableMap>

            {flowPairs.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] text-[var(--text-tertiary)]">
                No confirmed cross-region propagation in the current batch.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
