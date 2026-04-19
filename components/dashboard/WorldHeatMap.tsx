"use client";

import type { CSSProperties } from "react";
import type { GlobalTopic } from "@global-pulse/shared";
import { ComposableMap, Geographies, Geography, Line, Marker } from "react-simple-maps";
import type { RegionDashboardRow } from "@/lib/types/api";

interface WorldHeatMapProps {
  regions: RegionDashboardRow[];
  globalTopics?: GlobalTopic[];
  variant?: "community" | "news";
}

interface FlowEdge {
  from: string;
  to: string;
  lagMinutes: number;
  confidence: number;
  heatScore: number;
}

const GEO_URL = "/pulse/geo/countries-110m.json";

const REGION_COORDINATES: Record<string, [number, number]> = {
  kr: [127.8, 36.3],
  jp: [138.3, 36.2],
  tw: [121.0, 23.7],
  cn: [104.2, 35.9],
  us: [-98.6, 39.8],
  eu: [10.0, 51.2],
  me: [45.0, 24.0],
  ru: [90.0, 61.0],
  br: [-51.9, -14.2],
  in: [78.9, 22.6],
  id: [117.9, -2.2],
  mx: [-102.5, 23.6],
  au: [133.8, -25.3],
  vn: [108.3, 14.1],
  th: [100.9, 15.9],
  ar: [-64.2, -34.6],
  ca: [-106.3, 56.1],
  ng: [8.7, 9.1],
  za: [24.0, -29.0],
};

const HEAT_LEGEND = [
  { label: "cold < 100", color: "var(--heat-cold)" },
  { label: "warm < 300", color: "var(--heat-warm)" },
  { label: "hot < 600", color: "var(--heat-hot)" },
  { label: "fire < 1000", color: "var(--heat-fire)" },
  { label: "explosive >= 1000", color: "var(--heat-explosive)" },
];

function getHeatColor(score: number): string {
  if (score < 100) return "var(--heat-cold)";
  if (score < 300) return "var(--heat-warm)";
  if (score < 600) return "var(--heat-hot)";
  if (score < 1000) return "var(--heat-fire)";
  return "var(--heat-explosive)";
}

function toLagHours(lagMinutes: number): number {
  return Math.max(1, Math.round(lagMinutes / 60));
}

function getFlowEdges(globalTopics: GlobalTopic[]): FlowEdge[] {
  const edges = new Map<string, FlowEdge>();
  for (const topic of globalTopics.slice(0, 40)) {
    for (const edge of topic.propagationEdges ?? []) {
      if (!REGION_COORDINATES[edge.from] || !REGION_COORDINATES[edge.to]) {
        continue;
      }

      const key = `${edge.from}:${edge.to}`;
      const current = edges.get(key);
      const merged: FlowEdge = {
        from: edge.from,
        to: edge.to,
        lagMinutes: edge.lagMinutes,
        confidence: edge.confidence,
        heatScore: topic.totalHeatScore,
      };

      if (!current || merged.heatScore * merged.confidence > current.heatScore * current.confidence) {
        edges.set(key, merged);
      }
    }
  }

  return [...edges.values()]
    .sort((left, right) => right.heatScore * right.confidence - left.heatScore * left.confidence)
    .slice(0, 16);
}

export function WorldHeatMap({ regions, globalTopics = [], variant = "community" }: WorldHeatMapProps) {
  const maxHeat = Math.max(...regions.map((region) => region.totalHeatScore), 1);
  const flowEdges = getFlowEdges(globalTopics);
  const activeFlowRegionIds = new Set(flowEdges.flatMap((edge) => [edge.from, edge.to]));
  const accentStroke = variant === "news" ? "rgba(251, 146, 60, 0.9)" : "rgba(56, 189, 248, 0.85)";
  const accentFill = variant === "news" ? "#FCD34D" : "#67E8F9";
  const radialGlow =
    variant === "news"
      ? "bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.18),transparent_50%)]"
      : "bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14),transparent_50%)]";

  return (
    <div className="panel-grid relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
      <div className={`absolute inset-0 ${radialGlow}`} />
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

              {flowEdges.map((edge, index) => {
                const fromCoord = REGION_COORDINATES[edge.from];
                const toCoord = REGION_COORDINATES[edge.to];
                if (!fromCoord || !toCoord) {
                  return null;
                }

                const lineStyle = {
                  ["--map-flow-duration" as string]: `${4 + index * 1.2}s`,
                  opacity: Math.max(0.2, Math.min(1, edge.confidence)),
                } as CSSProperties;

                return (
                  <Line
                    key={`${edge.from}-${edge.to}-${index}`}
                    from={fromCoord}
                    to={toCoord}
                    stroke={accentStroke}
                    strokeWidth={1.35}
                    fill="none"
                    className="map-flow-line"
                    style={lineStyle}
                  />
                );
              })}

              {flowEdges.map((edge, index) => {
                const fromCoord = REGION_COORDINATES[edge.from];
                const toCoord = REGION_COORDINATES[edge.to];
                if (!fromCoord || !toCoord) {
                  return null;
                }
                const midpoint: [number, number] = [
                  Number(((fromCoord[0] + toCoord[0]) / 2).toFixed(3)),
                  Number(((fromCoord[1] + toCoord[1]) / 2).toFixed(3)),
                ];
                return (
                  <Marker key={`edge-label-${edge.from}-${edge.to}-${index}`} coordinates={midpoint}>
                    <text textAnchor="middle" y={-2} className="text-[9px] font-semibold" style={{ fill: accentFill }}>
                      +{toLagHours(edge.lagMinutes)}h
                    </text>
                  </Marker>
                );
              })}

              {flowEdges.map((edge, index) => {
                const coordinates = REGION_COORDINATES[edge.to];
                if (!coordinates) {
                  return null;
                }

                const dotStyle = {
                  ["--map-flow-dot-delay" as string]: `${index * 0.35}s`,
                  ["--map-flow-dot-duration" as string]: `${3.2 + index * 0.9}s`,
                  opacity: Math.max(0.25, Math.min(1, edge.confidence)),
                } as CSSProperties;

                return (
                  <Marker key={`flow-dot-${edge.to}-${index}`} coordinates={coordinates}>
                    <circle r={1.4} className="map-flow-dot" style={{ ...dotStyle, fill: accentFill }} />
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
                    <circle
                      r={2.6}
                      fill={color}
                      className={activeFlowRegionIds.has(region.id) ? "map-node-pulse" : ""}
                    />
                    <text y={-radius - 4} textAnchor="middle" className="fill-slate-200 text-[10px] font-medium">
                      {region.flagEmoji} {Math.round(region.totalHeatScore)}
                    </text>
                  </Marker>
                );
              })}
            </ComposableMap>

            {flowEdges.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] text-[var(--text-tertiary)]">
                No confirmed cross-region propagation in the current batch.
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {HEAT_LEGEND.map((item) => (
            <span
              key={item.label}
              className="rounded-full border border-[var(--border-default)] px-2 py-1 text-[10px] text-[var(--text-secondary)]"
            >
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}

          <details className="ml-auto text-[10px] text-[var(--text-secondary)]">
            <summary className="cursor-pointer select-none rounded-full border border-[var(--border-default)] px-2 py-1 hover:bg-[var(--bg-tertiary)]">
              Heat Score ?
            </summary>
            <p className="mt-2 max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 leading-relaxed">
              Heat Score는 게시글 볼륨과 반응량을 종합해 계산된 지표이며, 보통
              <br />
              (posts + comments*0.5 + views/1000) * source_diversity
              <br />
              형태로 해석할 수 있습니다.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
