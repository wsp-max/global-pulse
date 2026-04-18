"use client";

import type { CSSProperties } from "react";
import type { GlobalTopic } from "@global-pulse/shared";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
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

const REGION_ANCHORS: Record<string, [number, number]> = {
  kr: [77, 43],
  jp: [81, 44],
  tw: [76, 49],
  cn: [68, 45],
  us: [22, 44],
  eu: [53, 36],
  me: [59, 50],
  ru: [67, 24],
};

function getHeatColor(score: number): string {
  if (score < 100) return "var(--heat-cold)";
  if (score < 300) return "var(--heat-warm)";
  if (score < 600) return "var(--heat-hot)";
  if (score < 1000) return "var(--heat-fire)";
  return "var(--heat-explosive)";
}

function getFlowPairs(regions: RegionDashboardRow[], globalTopics: GlobalTopic[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();

  for (const topic of globalTopics.slice(0, 4)) {
    const ordered = new Set<string>();
    if (topic.firstSeenRegion) {
      ordered.add(topic.firstSeenRegion);
    }
    for (const regionId of topic.regions) {
      ordered.add(regionId);
    }

    const chain = [...ordered].filter((regionId) => REGION_COORDINATES[regionId]);
    for (let i = 0; i < chain.length - 1; i += 1) {
      const from = chain[i];
      const to = chain[i + 1];
      const key = `${from}->${to}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([from, to]);
      }
    }
  }

  if (pairs.length > 0) {
    return pairs;
  }

  const fallback = [...regions]
    .sort((a, b) => b.totalHeatScore - a.totalHeatScore)
    .slice(0, 4)
    .map((region) => region.id)
    .filter((regionId) => REGION_COORDINATES[regionId]);

  for (let i = 0; i < fallback.length - 1; i += 1) {
    const from = fallback[i];
    const to = fallback[i + 1];
    pairs.push([from, to]);
  }

  return pairs;
}

export function WorldHeatMap({ regions, globalTopics = [] }: WorldHeatMapProps) {
  const maxHeat = Math.max(...regions.map((region) => region.totalHeatScore), 1);
  const flowPairs = getFlowPairs(regions, globalTopics);

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
                    <circle r={2.6} fill={color} className="map-node-pulse" />
                    <text y={-radius - 4} textAnchor="middle" className="fill-slate-200 text-[10px] font-medium">
                      {region.flagEmoji} {Math.round(region.totalHeatScore)}
                    </text>
                  </Marker>
                );
              })}
            </ComposableMap>

            <svg
              className="pointer-events-none absolute inset-0 z-10"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {flowPairs.map(([from, to], index) => {
                const fromAnchor = REGION_ANCHORS[from];
                const toAnchor = REGION_ANCHORS[to];
                if (!fromAnchor || !toAnchor) {
                  return null;
                }

                const lineStyle = {
                  ["--map-flow-duration" as string]: `${4 + index * 1.2}s`,
                } as CSSProperties;

                const dotStyle = {
                  ["--map-flow-dot-delay" as string]: `${index * 0.35}s`,
                  ["--map-flow-dot-duration" as string]: `${3.2 + index * 0.9}s`,
                } as CSSProperties;

                return (
                  <g key={`${from}-${to}-${index}`}>
                    <line
                      className="map-flow-line"
                      x1={fromAnchor[0]}
                      y1={fromAnchor[1]}
                      x2={toAnchor[0]}
                      y2={toAnchor[1]}
                      style={lineStyle}
                    />
                    <circle className="map-flow-dot" cx={toAnchor[0]} cy={toAnchor[1]} r="0.9" style={dotStyle} />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
