"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobalTopic } from "@global-pulse/shared";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { MapControls } from "@/components/dashboard/MapControls";
import type { RegionDashboardRow } from "@/lib/types/api";
import { aggregateFlowEdges, getFlowStrokeColor, toVolumeBand } from "@/lib/utils/propagation-flow";
import { getHeatTier, toHeatBand } from "@/lib/utils/heat";

interface WorldHeatMapProps {
  regions: RegionDashboardRow[];
  globalTopics?: GlobalTopic[];
  variant?: "community" | "news";
  onTopicSelect?: (topicId: number) => void;
}

interface ClusterMarker {
  key: string;
  x: number;
  y: number;
  regions: RegionDashboardRow[];
  totalHeat: number;
  representativeColor: string;
}

const GEO_URL = "/pulse/geo/countries-110m.json";
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 6;

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

function buildClusterMarkers(regions: RegionDashboardRow[], zoom: number): ClusterMarker[] {
  const markers = regions
    .map((region) => {
      const coord = REGION_COORDINATES[region.id];
      if (!coord) {
        return null;
      }
      const pos = toMapPercent(coord);
      return {
        region,
        x: pos.x,
        y: pos.y,
      };
    })
    .filter((item): item is { region: RegionDashboardRow; x: number; y: number } => Boolean(item));

  if (zoom >= 1.5) {
    return markers.map((marker) => ({
      key: marker.region.id,
      x: marker.x,
      y: marker.y,
      regions: [marker.region],
      totalHeat: marker.region.totalHeatScore,
      representativeColor: marker.region.color,
    }));
  }

  const gridSize = 6;
  const buckets = new Map<string, ClusterMarker>();

  for (const marker of markers) {
    const gridX = Math.floor(marker.x / gridSize);
    const gridY = Math.floor(marker.y / gridSize);
    const key = `${gridX}:${gridY}`;
    const current = buckets.get(key);

    if (!current) {
      buckets.set(key, {
        key,
        x: marker.x,
        y: marker.y,
        regions: [marker.region],
        totalHeat: marker.region.totalHeatScore,
        representativeColor: marker.region.color,
      });
      continue;
    }

    const totalCount = current.regions.length + 1;
    current.x = (current.x * current.regions.length + marker.x) / totalCount;
    current.y = (current.y * current.regions.length + marker.y) / totalCount;
    current.regions.push(marker.region);
    current.totalHeat += marker.region.totalHeatScore;
  }

  return [...buckets.values()];
}

export function WorldHeatMap({ regions, globalTopics = [], variant = "community", onTopicSelect }: WorldHeatMapProps) {
  const maxHeat = Math.max(...regions.map((region) => region.totalHeatScore), 1);
  const flowEdges = useMemo(
    () =>
      aggregateFlowEdges(globalTopics, {
        limit: 20,
        maxTopics: 64,
        isValidRegion: (regionId) => Boolean(REGION_COORDINATES[regionId]),
      }),
    [globalTopics],
  );
  const maxVolume = Math.max(...flowEdges.map((edge) => edge.volumeHeatSum), 1);
  const activeFlowRegionIds = new Set(flowEdges.flatMap((edge) => [edge.from, edge.to]));
  const radialGlow =
    variant === "news"
      ? "bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.18),transparent_50%)]"
      : "bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14),transparent_50%)]";

  const maxVelocity = Math.max(...globalTopics.map((topic) => topic.velocityPerHour ?? 0), 1);
  const surgingVelocityCutoff = maxVelocity * 0.9;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();

    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const clampOffset = (nextX: number, nextY: number, nextZoom = zoom) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: nextX, y: nextY };
    }

    const maxX = ((nextZoom - 1) * rect.width) / 2;
    const maxY = ((nextZoom - 1) * rect.height) / 2;

    return {
      x: clamp(nextX, -maxX, maxX),
      y: clamp(nextY, -maxY, maxY),
    };
  };

  const applyZoom = (nextZoom: number) => {
    const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    setZoom(clamped);
    setOffset((prev) => clampOffset(prev.x, prev.y, clamped));
  };

  const markers = useMemo(() => buildClusterMarkers(regions, zoom), [regions, zoom]);

  return (
    <div className="panel-grid relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
      <div className={`absolute inset-0 ${radialGlow}`} />
      <div className="relative">
        <p className="font-display text-lg text-[var(--text-accent)]">WORLD HEAT MAP</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Regional heat and cross-region signal routes.</p>

        <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2">
          <div
            ref={viewportRef}
            className="relative h-[220px] overflow-hidden rounded-lg sm:h-[300px]"
            style={{ touchAction: "none" }}
            onWheel={(event) => {
              event.preventDefault();
              const ratio = event.deltaY < 0 ? 1.4 : 1 / 1.4;
              applyZoom(zoom * ratio);
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              dragRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                originX: offset.x,
                originY: offset.y,
              };
              setIsDragging(true);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!dragRef.current) {
                return;
              }
              const dx = event.clientX - dragRef.current.startX;
              const dy = event.clientY - dragRef.current.startY;
              setOffset(clampOffset(dragRef.current.originX + dx, dragRef.current.originY + dy));
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              dragRef.current = null;
              setIsDragging(false);
            }}
            onPointerCancel={() => {
              dragRef.current = null;
              setIsDragging(false);
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: reducedMotion || isDragging ? "none" : "transform 180ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <ComposableMap projectionConfig={{ scale: 145 }} style={{ width: "100%", height: "100%" }}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography key={geo.rsmKey} geography={geo} fill="#0f172a" stroke="#334155" strokeWidth={0.45} />
                    ))
                  }
                </Geographies>
              </ComposableMap>

              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  {flowEdges.map((edge, index) => {
                    const volumeBand = toVolumeBand(edge.volumeHeatSum, maxVolume);
                    const flowColor = getFlowStrokeColor(variant, volumeBand);
                    return (
                      <marker
                        key={`arrow-${edge.from}-${edge.to}-${index}`}
                        id={`arrow-${variant}-${index}`}
                        markerWidth="5"
                        markerHeight="5"
                        refX="4.2"
                        refY="2.5"
                        orient="auto"
                        markerUnits="strokeWidth"
                      >
                        <path d={variant === "news" ? "M 0 0 L 5 2.5 L 0 5 L 1.6 2.5 z" : "M 0 0 L 5 2.5 L 0 5 z"} fill={flowColor} />
                      </marker>
                    );
                  })}
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
                  const volumeBand = toVolumeBand(edge.volumeHeatSum, maxVolume);
                  const durationSec = Math.max(3.2, Math.min(5.5, 5.7 - volumeBand * 2.5));
                  const flowColor = getFlowStrokeColor(variant, volumeBand);
                  const strokeOpacity = Math.max(0.3, Math.min(0.9, edge.confidence));
                  const strokeWidth = 0.5 + Math.max(0, Math.min(0.8, volumeBand * 0.8));
                  const isFast = edge.velocity >= surgingVelocityCutoff;
                  const particleCount = edge.confidence >= 0.75 ? 3 : edge.confidence >= 0.45 ? 2 : 1;
                  const lagText = `${toLagText(edge.lagMinutes)}${isFast ? " ⚡" : ""}`;

                  return (
                    <g key={`${edge.from}-${edge.to}-${index}`}>
                      <path
                        className="map-flow-path"
                        d={curve.d}
                        stroke={flowColor}
                        strokeWidth={strokeWidth}
                        fill="none"
                        opacity={strokeOpacity}
                        markerEnd={`url(#arrow-${variant}-${index})`}
                        style={{ pointerEvents: "none" }}
                      >
                        <title>{`From ${edge.from.toUpperCase()} to ${edge.to.toUpperCase()}, lag ${toLagText(edge.lagMinutes)}, confidence ${edge.confidence.toFixed(2)}, volume ${Math.round(edge.volumeHeatSum)}, edges ${edge.edgeCount}`}</title>
                      </path>

                      <g transform={`translate(${curve.mx} ${curve.my})`} style={{ pointerEvents: "none" }}>
                        <rect x={-5} y={-3.4} width={10} height={4.8} rx={2.4} fill="rgba(10,14,23,0.75)" stroke="rgba(148,163,184,0.25)" />
                        <text textAnchor="middle" y={0.1} className="font-mono text-[2.6px]" fill={flowColor}>
                          {lagText}
                        </text>
                      </g>

                      {!reducedMotion &&
                        Array.from({ length: particleCount }).map((_, particleIndex) => (
                          <circle
                            key={`particle-${index}-${particleIndex}`}
                            r="0.35"
                            fill={flowColor}
                            opacity={0.75}
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

                {markers.map((marker) => {
                  const band = toHeatBand(marker.totalHeat, maxHeat * Math.max(1, marker.regions.length));
                  const radius = marker.regions.length > 1 ? 1.4 + band * 3.1 : 1.1 + band * 2.6;
                  const fill = getTierColorByBand(band);
                  const primaryRegion = marker.regions[0]!;
                  const targetTopicId = marker.regions
                    .flatMap((region) => region.topTopics)
                    .map((topic) => topic.id)
                    .find((topicId): topicId is number => typeof topicId === "number");
                  const canOpenTopic = Boolean(onTopicSelect && targetTopicId);

                  return (
                    <g
                      key={marker.key}
                      transform={`translate(${marker.x} ${marker.y})`}
                      className={canOpenTopic ? "cursor-pointer" : undefined}
                      onPointerDown={(event) => {
                        if (!canOpenTopic) return;
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        if (!canOpenTopic || !targetTopicId) return;
                        event.stopPropagation();
                        onTopicSelect?.(targetTopicId);
                      }}
                    >
                      <circle
                        r={radius}
                        fill={fill}
                        fillOpacity={0.22}
                        stroke={marker.representativeColor}
                        strokeWidth={0.35}
                        aria-label={`${primaryRegion.flagEmoji} ${primaryRegion.nameKo} heat ${Math.round(marker.totalHeat)} tier ${getHeatTier(band)}`}
                      />
                      <circle r={activeFlowRegionIds.has(primaryRegion.id) ? 0.62 : 0.5} fill={fill} />
                      <text y={-(radius + 0.75)} textAnchor="middle" className="text-[2.9px] font-medium" fill="#e2e8f0">
                        {marker.regions.length > 1
                          ? `+${marker.regions.length}`
                          : `${primaryRegion.flagEmoji} ${Math.round(primaryRegion.totalHeatScore)}`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <MapControls
              onZoomIn={() => applyZoom(zoom * 1.4)}
              onZoomOut={() => applyZoom(zoom / 1.4)}
              onReset={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            />

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
