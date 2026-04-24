"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, type GeoProjection } from "d3-geo";
import type { GlobalTopic } from "@global-pulse/shared";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { MapControls } from "@/components/dashboard/MapControls";
import type { RegionDashboardRow } from "@/lib/types/api";
import { aggregateFlowEdges, getFlowStrokeColor, toVolumeBand } from "@/lib/utils/propagation-flow";
import { getHeatTier, toHeatBand } from "@/lib/utils/heat";
import {
  countQualifiedRoutes,
  getGlobalTopicIdentity,
  getScopeShortLabel,
  prepareQualifiedGlobalTopics,
} from "@/lib/utils/signal-quality";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

interface WorldHeatMapProps {
  regions: RegionDashboardRow[];
  globalTopics?: GlobalTopic[];
  comparisonGlobalTopics?: GlobalTopic[];
  comparisonScope?: "community" | "news";
  variant?: "community" | "news";
  compact?: boolean;
  onTopicSelect?: (topicId: number) => void;
}

interface ProjectedEdge {
  key: string;
  from: string;
  to: string;
  path: string;
  mx: number;
  my: number;
  volumeBand: number;
  lagMinutes: number;
  confidence: number;
  edgeCount: number;
  velocity: number;
}

interface ProjectedMarker {
  key: string;
  region: RegionDashboardRow;
  x: number;
  y: number;
  radius: number;
  fill: string;
  band: number;
  isFlowActive: boolean;
  targetTopicId: number | null;
}

const GEO_URL = "/pulse/geo/countries-110m.json";
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 560;
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

const EU_COUNTRY_CODES = new Set([
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "BE",
  "PL",
  "SE",
  "AT",
  "DK",
  "FI",
  "IE",
  "PT",
  "CZ",
  "GR",
  "HU",
  "RO",
  "BG",
  "HR",
  "SK",
  "SI",
  "EE",
  "LV",
  "LT",
  "LU",
  "MT",
  "CY",
]);

function resolveRegionIdFromGeography(geo: { properties?: Record<string, unknown> }): string | null {
  const props = geo.properties ?? {};
  const iso2Raw =
    (props.ISO_A2 as string | undefined) ??
    (props.iso_a2 as string | undefined) ??
    (props.iso2 as string | undefined);
  const iso2 = typeof iso2Raw === "string" ? iso2Raw.trim().toUpperCase() : "";

  if (iso2 === "US") return "us";
  if (iso2 === "CN") return "cn";
  if (iso2 === "JP") return "jp";
  if (iso2 === "KR") return "kr";
  if (iso2 === "TW") return "tw";
  if (iso2 === "RU") return "ru";
  if (iso2 === "BR") return "br";
  if (iso2 === "IN") return "in";
  if (iso2 === "ID") return "id";
  if (iso2 === "MX") return "mx";
  if (iso2 === "AU") return "au";
  if (iso2 === "VN") return "vn";
  if (iso2 === "TH") return "th";
  if (iso2 === "AR") return "ar";
  if (iso2 === "CA") return "ca";
  if (iso2 === "NG") return "ng";
  if (iso2 === "ZA") return "za";
  if (EU_COUNTRY_CODES.has(iso2)) return "eu";

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  const arcOffset = Math.max(24, Math.abs(to.x - from.x) * 0.16);
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
  return acceleration > 0 && velocity >= velocityThreshold;
}

function buildSharedTopicCount(primaryTopics: GlobalTopic[], secondaryTopics: GlobalTopic[]): number {
  const secondaryLookup = new Set(
    secondaryTopics.map((topic) => getGlobalTopicIdentity(topic)).filter((value): value is string => Boolean(value)),
  );

  return primaryTopics.reduce((sum, topic) => {
    const identity = getGlobalTopicIdentity(topic);
    return identity && secondaryLookup.has(identity) ? sum + 1 : sum;
  }, 0);
}

interface FlowOverlayProps {
  regions: RegionDashboardRow[];
  edges: ReturnType<typeof aggregateFlowEdges>;
  maxVolume: number;
  maxHeat: number;
  variant: "community" | "news";
  projection: GeoProjection;
  showFlowLabels: boolean;
  reducedMotion: boolean;
  hoveredRegion: string | null;
  onHoveredRegionChange: (regionId: string | null) => void;
  onTopicSelect?: (topicId: number) => void;
}

function FlowOverlay({
  regions,
  edges,
  maxVolume,
  maxHeat,
  variant,
  projection,
  showFlowLabels,
  reducedMotion,
  hoveredRegion,
  onHoveredRegionChange,
  onTopicSelect,
}: FlowOverlayProps) {
  const activeFlowRegionIds = useMemo(() => new Set(edges.flatMap((edge) => [edge.from, edge.to])), [edges]);

  const projectedEdges = useMemo<ProjectedEdge[]>(() => {
    return edges
      .map((edge, index) => {
        const fromCoord = REGION_COORDINATES[edge.from];
        const toCoord = REGION_COORDINATES[edge.to];
        if (!fromCoord || !toCoord) {
          return null;
        }

        const fromPoint = projection(fromCoord);
        const toPoint = projection(toCoord);
        if (!fromPoint || !toPoint) {
          return null;
        }

        const [fromX, fromY] = fromPoint;
        const [toX, toY] = toPoint;
        const curve = curvePath({ x: fromX, y: fromY }, { x: toX, y: toY });

        return {
          key: `${edge.from}-${edge.to}-${index}`,
          from: edge.from,
          to: edge.to,
          path: curve.d,
          mx: curve.mx,
          my: curve.my,
          volumeBand: toVolumeBand(edge.volumeHeatSum, maxVolume),
          lagMinutes: edge.lagMinutes,
          confidence: edge.confidence,
          edgeCount: edge.edgeCount,
          velocity: edge.velocity,
        };
      })
      .filter((edge): edge is ProjectedEdge => Boolean(edge));
  }, [edges, maxVolume, projection]);

  const markers = useMemo<ProjectedMarker[]>(() => {
    return regions
      .map((region) => {
        if (region.totalHeatScore <= 0) {
          return null;
        }

        const coord = REGION_COORDINATES[region.id];
        if (!coord) {
          return null;
        }

        const point = projection(coord);
        if (!point) {
          return null;
        }

        const [x, y] = point;
        const band = toHeatBand(region.totalHeatScore, maxHeat);
        const fill = getTierColorByBand(band);
        const radius = 5 + band * 16;
        const targetTopicId = region.topTopics
          .map((topic) => topic.id)
          .find((topicId): topicId is number => typeof topicId === "number") ?? null;

        return {
          key: region.id,
          region,
          x,
          y,
          radius,
          fill,
          band,
          isFlowActive: activeFlowRegionIds.has(region.id),
          targetTopicId,
        };
      })
      .filter((marker): marker is ProjectedMarker => Boolean(marker));
  }, [activeFlowRegionIds, maxHeat, projection, regions]);

  return (
    <g>
      <defs>
        {projectedEdges.map((edge) => {
          const flowColor = getFlowStrokeColor(variant, edge.volumeBand);
          return (
            <marker
              key={`arrow-${edge.key}`}
              id={`arrow-${variant}-${edge.key}`}
              markerWidth="8"
              markerHeight="8"
              refX="6.5"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d={variant === "news" ? "M 0 0 L 8 4 L 0 8 L 2.8 4 z" : "M 0 0 L 8 4 L 0 8 z"} fill={flowColor} />
            </marker>
          );
        })}
        <filter id={`particle-glow-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {projectedEdges.map((edge) => {
        const flowColor = getFlowStrokeColor(variant, edge.volumeBand);
        const strokeOpacity = Math.max(0.24, Math.min(0.68, edge.confidence * 0.7));
        const strokeWidth = 1.2 + Math.max(0, Math.min(2.5, edge.volumeBand * 2.5));
        const isFast = edge.velocity > 0;
        const isHoveredFlow = hoveredRegion ? edge.from === hoveredRegion || edge.to === hoveredRegion : false;
        const resolvedOpacity = hoveredRegion
          ? isHoveredFlow
            ? Math.min(0.95, strokeOpacity * 1.45)
            : Math.max(0.09, strokeOpacity * 0.35)
          : strokeOpacity;
        const durationSec = Math.max(3.2, Math.min(5.5, 5.7 - edge.volumeBand * 2.5));
        const particleCount = edge.confidence >= 0.85 ? 2 : edge.confidence >= 0.55 ? 1 : 0;

        return (
          <g key={edge.key}>
            <path
              d={edge.path}
              stroke={flowColor}
              strokeWidth={strokeWidth}
              fill="none"
              opacity={resolvedOpacity}
              markerEnd={`url(#arrow-${variant}-${edge.key})`}
              style={{ pointerEvents: "none" }}
            >
              <title>{`From ${edge.from.toUpperCase()} to ${edge.to.toUpperCase()}, lag ${toLagText(edge.lagMinutes)}, confidence ${edge.confidence.toFixed(2)}, edges ${edge.edgeCount}`}</title>
            </path>

            {(showFlowLabels || isHoveredFlow) && (
              <g transform={`translate(${edge.mx} ${edge.my})`} style={{ pointerEvents: "none" }}>
                <rect x={-34} y={-14} width={68} height={20} rx={10} fill="rgba(10,14,23,0.72)" stroke="none" />
                <text textAnchor="middle" y={0} fontSize="9" fill={flowColor} className="font-mono">
                  {`${toLagText(edge.lagMinutes)}${isFast ? " • 이동" : ""}`}
                </text>
              </g>
            )}

            {!reducedMotion &&
              Array.from({ length: particleCount }).map((_, particleIndex) => (
                <circle
                  key={`particle-${edge.key}-${particleIndex}`}
                  r="3"
                  fill={flowColor}
                  opacity="0.7"
                  filter={`url(#particle-glow-${variant})`}
                >
                  <animateMotion
                    dur={`${durationSec}s`}
                    begin={`${particleIndex * 0.6}s`}
                    repeatCount="indefinite"
                    rotate="auto"
                    path={edge.path}
                  />
                </circle>
              ))}
          </g>
        );
      })}

      {markers.map((marker) => {
        const canOpenTopic = Boolean(onTopicSelect && marker.targetTopicId);

        return (
          <g
            key={marker.key}
            transform={`translate(${marker.x} ${marker.y})`}
            className={canOpenTopic ? "cursor-pointer" : undefined}
            onPointerDown={(event) => {
              if (!canOpenTopic) {
                return;
              }
              event.stopPropagation();
            }}
            onClick={(event) => {
              if (!canOpenTopic || !marker.targetTopicId) {
                return;
              }
              event.stopPropagation();
              onTopicSelect?.(marker.targetTopicId);
            }}
            onMouseEnter={() => onHoveredRegionChange(marker.region.id)}
            onMouseLeave={() => onHoveredRegionChange(null)}
          >
            <circle
              r={marker.radius}
              fill={marker.fill}
              fillOpacity={0.18 + marker.band * 0.32}
              stroke={marker.region.color}
              strokeWidth={marker.isFlowActive ? 2.2 : 1.4}
            />
            <circle r={marker.isFlowActive ? 4.2 : 3.4} fill={marker.fill} />
            <text y={-(marker.radius + 10)} textAnchor="middle" fontSize="11" fontWeight="600" fill="#e2e8f0">
              {marker.region.flagEmoji} {Math.round(marker.region.totalHeatScore)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function WorldHeatMap({
  regions,
  globalTopics = [],
  comparisonGlobalTopics = [],
  comparisonScope,
  variant = "community",
  compact = false,
  onTopicSelect,
}: WorldHeatMapProps) {
  const resolvedComparisonScope = comparisonScope ?? (variant === "community" ? "news" : "community");
  const maxHeat = Math.max(...regions.map((region) => region.totalHeatScore), 1);
  const primaryQualifiedTopics = useMemo(() => prepareQualifiedGlobalTopics(globalTopics, variant), [globalTopics, variant]);
  const comparisonQualifiedTopics = useMemo(
    () => prepareQualifiedGlobalTopics(comparisonGlobalTopics, resolvedComparisonScope),
    [comparisonGlobalTopics, resolvedComparisonScope],
  );
  const flowEdges = useMemo(
    () =>
      aggregateFlowEdges(primaryQualifiedTopics, {
        limit: variant === "community" ? 120 : 60,
        maxTopics: variant === "community" ? 384 : 192,
        isValidRegion: (regionId) => Boolean(REGION_COORDINATES[regionId]),
      }),
    [primaryQualifiedTopics, variant],
  );
  const maxVolume = Math.max(...flowEdges.map((edge) => edge.volumeHeatSum), 1);
  const radialGlow =
    variant === "news"
      ? "bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.18),transparent_50%)]"
      : "bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14),transparent_50%)]";

  const maxVelocity = Math.max(...primaryQualifiedTopics.map((topic) => topic.velocityPerHour ?? 0), 1);
  const surgingVelocityCutoff = maxVelocity * 0.9;
  const primaryRouteCount = useMemo(() => countQualifiedRoutes(globalTopics, variant), [globalTopics, variant]);
  const comparisonRouteCount = useMemo(
    () => countQualifiedRoutes(comparisonGlobalTopics, resolvedComparisonScope),
    [comparisonGlobalTopics, resolvedComparisonScope],
  );
  const sharedTopicCount = useMemo(
    () => buildSharedTopicCount(primaryQualifiedTopics, comparisonQualifiedTopics),
    [comparisonQualifiedTopics, primaryQualifiedTopics],
  );

  const regionHeatMap = useMemo(() => new Map(regions.map((region) => [region.id, region])), [regions]);
  const projection = useMemo(
    () => geoEqualEarth().translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]).scale(175),
    [],
  );

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showFlowLabels, setShowFlowLabels] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

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

  return (
    <div className="panel-grid relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-2">
      <div className={`absolute inset-0 ${radialGlow}`} />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-lg text-[var(--text-accent)]">세계 확산 지도</p>
            <p className="mt-1 break-words text-xs text-[var(--text-secondary)]">선택 source의 지역 heat와 확인된 확산 경로만 표시합니다.</p>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={showFlowLabels}
              onChange={(event) => setShowFlowLabels(event.target.checked)}
              className="accent-[var(--text-accent)]"
            />
            경로 라벨
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
          <span className="rounded-full border border-[var(--border-default)] px-2 py-1">
            {getScopeShortLabel(variant)} routes {flowEdges.length} / confirmed {primaryRouteCount}
          </span>
          <span className="rounded-full border border-[var(--border-default)] px-2 py-1">
            {getScopeShortLabel(resolvedComparisonScope)} confirmed routes {comparisonRouteCount}
          </span>
          <span className="rounded-full border border-[var(--border-default)] px-2 py-1">양측 공통 이슈 {sharedTopicCount}</span>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2">
          <div
            ref={viewportRef}
            className={`relative overflow-hidden rounded-lg ${
              compact ? "h-[360px]" : "h-[520px] sm:h-[620px] lg:h-[720px] xl:h-[780px]"
            }`}
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
              <ComposableMap
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                projectionConfig={{ scale: 175 }}
                style={{ width: "100%", height: "100%" }}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const regionId = resolveRegionIdFromGeography(geo as unknown as { properties?: Record<string, unknown> });
                      const region = regionId ? regionHeatMap.get(regionId) : null;
                      const band = region ? toHeatBand(region.totalHeatScore, maxHeat) : 0;
                      const fillOpacity = region ? 0.16 + band * 0.38 : 1;
                      const strokeWidth = hoveredRegion && regionId === hoveredRegion ? 1.2 : 0.45;

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={region ? region.color : "#0f172a"}
                          fillOpacity={fillOpacity}
                          stroke={hoveredRegion && regionId === hoveredRegion ? "#f8fafc" : "#334155"}
                          strokeWidth={strokeWidth}
                          onMouseEnter={() => {
                            if (regionId) {
                              setHoveredRegion(regionId);
                            }
                          }}
                          onMouseLeave={() => setHoveredRegion(null)}
                        />
                      );
                    })
                  }
                </Geographies>

                <FlowOverlay
                  regions={regions}
                  edges={flowEdges}
                  maxVolume={maxVolume}
                  maxHeat={maxHeat}
                  variant={variant}
                  projection={projection}
                  showFlowLabels={showFlowLabels}
                  reducedMotion={reducedMotion}
                  hoveredRegion={hoveredRegion}
                  onHoveredRegionChange={setHoveredRegion}
                  onTopicSelect={onTopicSelect}
                />
              </ComposableMap>
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
                현재 배치에서 확인된 리전 간 확산 경로가 없습니다.
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
              Heat Score 안내
            </summary>
            <p className="mt-2 max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 leading-relaxed">
              Heat Score는 게시글/댓글/조회수와 소스 다양성을 반영한 관심도 지표입니다.
              <br />
              지도 색과 마커 크기는 heat_score_display(로그 정규화)를 기반으로 시각화합니다.
            </p>
          </details>
        </div>

        {primaryQualifiedTopics.some((topic) => isSurging(topic, surgingVelocityCutoff)) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {primaryQualifiedTopics
              .filter((topic) => isSurging(topic, surgingVelocityCutoff))
              .slice(0, 3)
              .map((topic) => (
                <span key={`surging-${topic.id ?? topic.nameEn}`} className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-red-300">
                  급상승 ·
                  {" "}
                  {getDisplayTopicName({
                    id: topic.id,
                    nameKo: topic.nameKo,
                    nameEn: topic.nameEn,
                    summaryKo: topic.summaryKo,
                    summaryEn: topic.summaryEn,
                  })}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
