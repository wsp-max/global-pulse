"use client";

import { useMemo } from "react";
import type { GlobalTopic } from "@global-pulse/shared";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import type { RegionDashboardRow } from "@/lib/types/api";
import { getHeatTier, toHeatBand } from "@/lib/utils/heat";

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
  velocity: number;
  spreadScore: number;
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
  { label: "low", color: "var(--heat-low)" },
  { label: "mid", color: "var(--heat-mid)" },
  { label: "high", color: "var(--heat-high)" },
];

function toMapPercent([lon, lat]: [number, number]): { x: number; y: number } {
  const x = ((lon + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x, y };
}

function toLagText(lagMinutes: number): string {
  if (lagMinutes < 60) {
    return `+${Math.max(1, Math.round(lagMinutes))}m`;
  }
  return `+${Math.max(1, Math.round(lagMinutes / 60))}h`;
}

function getTierColorByBand(band: number): string {
  const tier = getHeatTier(band);
  if (tier === "low") return "var(--heat-low)";
  if (tier === "mid") return "var(--heat-mid)";
  return "var(--heat-high)";
}

function getFlowEdges(globalTopics: GlobalTopic[]): FlowEdge[] {
  const edges = new Map<string, FlowEdge>();
  for (const topic of globalTopics.slice(0, 48)) {
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
        velocity: topic.velocityPerHour ?? 0,
        spreadScore: topic.spreadScore ?? 0,
      };

      if (!current || merged.heatScore * merged.confidence > current.heatScore * current.confidence) {
        edges.set(key, merged);
      }
    }
  }

  return [...edges.values()]
    .sort((left, right) => right.heatScore * right.confidence - left.heatScore * left.confidence)
    .slice(0, 20);
}

function curvePath(from: { x: number; y: number }, to: { x: number; y: number }): { d: string; mx: number; my: number } {
  const mx = (from.x + to.x) / 2;
  const arcOffset = Math.max(6, Math.abs(to.x - from.x) * 0.18);
  const my = (from.y + to.y) / 2 - arcOffset;
  return {
    d: `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`,
    mx,
    my,
  };
}

function isSurging(topic: GlobalTopic, velocityThreshold: number): boolean {
  const velocity = topic.velocityPerHour ?? 0;
  const acceleration = topic.acceleration ?? 0;
  const burst = (topic as { burstZ?: number | null }).burstZ ?? null;
  return burst !== null ? burst >= 2.5 : acceleration > 0 && velocity >= velocityThreshold;
}

export function WorldHeatMap({ regions, globalTopics = [], variant = "community" }: WorldHeatMapProps) {
  const maxHeat = Math.max(...regions.map((region) => region.totalHeatScore), 1);
  const flowEdges = useMemo(() => getFlowEdges(globalTopics), [globalTopics]);
  const activeFlowRegionIds = new Set(flowEdges.flatMap((edge) => [edge.from, edge.to]));
  const accentFill = variant === "news" ? "#FCD34D" : "#67E8F9";
  const radialGlow =
    variant === "news"
      ? "bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.18),transparent_50%)]"
      : "bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14),transparent_50%)]";

  const maxVelocity = Math.max(...globalTopics.map((topic) => topic.velocityPerHour ?? 0), 1);
  const surgingVelocityCutoff = maxVelocity * 0.9;

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
                    <Geography key={geo.rsmKey} geography={geo} fill="#0f172a" stroke="#334155" strokeWidth={0.45} />
                  ))
                }
              </Geographies>
            </ComposableMap>

            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                {flowEdges.map((edge, index) => (
                  <linearGradient key={`grad-${edge.from}-${edge.to}-${index}`} id={`edge-grad-${variant}-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={variant === "news" ? "#F59E0B" : "#38BDF8"} />
                    <stop offset="100%" stopColor={variant === "news" ? "#FB923C" : "#22D3EE"} />
                  </linearGradient>
                ))}
                <marker id={`arrow-${variant}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d={variant === "news" ? "M 0 0 L 6 3 L 0 6 L 2 3 z" : "M 0 0 L 6 3 L 0 6 z"} fill={accentFill} />
                </marker>
                <filter id={`particle-glow-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="0.6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {flowEdges.map((edge, index) => {
                const from = toMapPercent(REGION_COORDINATES[edge.from]!);
                const to = toMapPercent(REGION_COORDINATES[edge.to]!);
                const curve = curvePath(from, to);
                const lagHours = Math.max(1, Math.round(edge.lagMinutes / 60));
                const durationSec = Math.max(3, Math.min(9, lagHours / 2));
                const strokeOpacity = Math.max(0.3, Math.min(0.9, edge.confidence));
                const strokeWidth = 1 + Math.max(0, Math.min(1.4, edge.confidence * 1.4));
                const isFast = edge.velocity >= surgingVelocityCutoff;
                const particleCount = edge.confidence >= 0.75 ? 3 : edge.confidence >= 0.45 ? 2 : 1;
                const lagText = `${toLagText(edge.lagMinutes)}${isFast ? " ⚡" : ""}`;

                return (
                  <g key={`${edge.from}-${edge.to}-${index}`}>
                    <path
                      d={curve.d}
                      stroke={`url(#edge-grad-${variant}-${index})`}
                      strokeWidth={strokeWidth}
                      fill="none"
                      opacity={strokeOpacity}
                      markerEnd={`url(#arrow-${variant})`}
                    >
                      <title>{`From ${edge.from.toUpperCase()} to ${edge.to.toUpperCase()}, lag ${toLagText(edge.lagMinutes)}, confidence ${edge.confidence.toFixed(2)}`}</title>
                    </path>

                    <g transform={`translate(${curve.mx} ${curve.my})`}>
                      <rect x={-5} y={-3.4} width={10} height={4.8} rx={2.4} fill="rgba(10,14,23,0.75)" stroke="rgba(148,163,184,0.25)" />
                      <text textAnchor="middle" y={0.1} className="font-mono text-[2.6px]" fill={accentFill}>
                        {lagText}
                      </text>
                    </g>

                    {Array.from({ length: particleCount }).map((_, particleIndex) => (
                      <circle
                        key={`particle-${index}-${particleIndex}`}
                        r="0.45"
                        fill={variant === "news" ? "#FB923C" : "#22D3EE"}
                        filter={`url(#particle-glow-${variant})`}
                        className="map-particle"
                      >
                        <animateMotion
                          dur={`${durationSec}s`}
                          begin={`${particleIndex * 0.6}s`}
                          repeatCount="indefinite"
                          rotate="auto"
                          path={curve.d}
                        />
                      </circle>
                    ))}
                  </g>
                );
              })}

              {regions.map((region) => {
                const coord = REGION_COORDINATES[region.id];
                if (!coord) return null;
                const pos = toMapPercent(coord);
                const band = typeof region.totalHeatScore === "number" ? toHeatBand(region.totalHeatScore, maxHeat) : 0;
                const radius = 1.1 + band * 2.6;
                const fill = getTierColorByBand(band);

                return (
                  <g key={region.id} transform={`translate(${pos.x} ${pos.y})`}>
                    <circle
                      r={radius}
                      fill={fill}
                      fillOpacity={0.22}
                      stroke={region.color}
                      strokeWidth={0.35}
                      aria-label={`${region.flagEmoji} ${region.nameKo} heat ${Math.round(region.totalHeatScore)} tier ${getHeatTier(band)}`}
                    />
                    <circle r={0.55} fill={fill} className={activeFlowRegionIds.has(region.id) ? "map-node-pulse" : ""} />
                    <text y={-(radius + 0.75)} textAnchor="middle" className="text-[2.9px] font-medium" fill="#e2e8f0">
                      {region.flagEmoji} {Math.round(region.totalHeatScore)}
                    </text>
                  </g>
                );
              })}
            </svg>

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
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
              {item.label}
            </span>
          ))}

          <details className="ml-auto text-[10px] text-[var(--text-secondary)]">
            <summary className="cursor-pointer select-none rounded-full border border-[var(--border-default)] px-2 py-1 hover:bg-[var(--bg-tertiary)]">
              Heat Score ?
            </summary>
            <p className="mt-2 max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 leading-relaxed">
              Heat Score는 게시글/댓글/조회수와 소스 다양성을 반영한 관심도 지표입니다.
              <br />
              표시 막대와 색상은 heat_score_display(로그 정규화)를 사용합니다.
            </p>
          </details>
        </div>

        {globalTopics.some((topic) => isSurging(topic, surgingVelocityCutoff)) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {globalTopics
              .filter((topic) => isSurging(topic, surgingVelocityCutoff))
              .slice(0, 3)
              .map((topic) => (
                <span key={`surging-${topic.id ?? topic.nameEn}`} className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-red-300">
                  🔥 surging · {topic.nameKo || topic.nameEn}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
