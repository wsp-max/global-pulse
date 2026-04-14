"use client";

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import type { RegionDashboardRow } from "@/lib/types/api";

interface WorldHeatMapProps {
  regions: RegionDashboardRow[];
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

export function WorldHeatMap({ regions }: WorldHeatMapProps) {
  const maxHeat = Math.max(...regions.map((region) => region.totalHeatScore), 1);

  return (
    <div className="panel-grid relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14),transparent_50%)]" />
      <div className="relative">
        <p className="font-display text-lg text-[var(--text-accent)]">WORLD HEAT MAP</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          리전별 열기 점수를 세계 지도 위에 표시합니다.
        </p>

        <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2">
          <ComposableMap projectionConfig={{ scale: 145 }} style={{ width: "100%", height: "300px" }}>
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
                  <circle r={2.6} fill={color} />
                  <text y={-radius - 4} textAnchor="middle" className="fill-slate-200 text-[10px] font-medium">
                    {region.flagEmoji} {Math.round(region.totalHeatScore)}
                  </text>
                </Marker>
              );
            })}
          </ComposableMap>
        </div>
      </div>
    </div>
  );
}

