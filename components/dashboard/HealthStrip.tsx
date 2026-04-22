"use client";

import type { ReactNode } from "react";
import { getRegionById } from "@global-pulse/shared";
import useSWR from "swr";
import { fetcher } from "@/lib/api";

interface RegionsHealthResponse {
  activeRegions?: number;
  totalRegions?: number;
  latestSnapshotAt?: string | null;
}

interface AnalyzerHealthResponse {
  metrics?: {
    geminiSuccessRate?: number;
  };
}

interface SourceHealthResponse {
  sourceStats?: Array<{
    id: string;
    regionId: string;
    name: string;
    lastScrapedAt: string | null;
    recentErrorCode: string | null;
    isDegraded: boolean;
  }>;
}

interface HealthStripProps {
  hottestLabel?: string | null;
  hottestHeat?: number | null;
}

function ageMinutes(iso: string | null | undefined): number | null {
  if (!iso) {
    return null;
  }
  const parsed = new Date(iso).getTime();
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - parsed) / 60_000));
}

function freshnessClass(minutes: number | null): string {
  if (minutes === null) {
    return "text-[var(--text-tertiary)]";
  }
  if (minutes <= 5) {
    return "text-emerald-300";
  }
  if (minutes <= 30) {
    return "text-amber-300";
  }
  return "text-red-300";
}

function pickDelayedSource(data: SourceHealthResponse | undefined): { label: string; delayMinutes: number } | null {
  const candidates = (data?.sourceStats ?? [])
    .filter((item) => item.isDegraded)
    .map((item) => {
      const minutes = ageMinutes(item.lastScrapedAt);
      return {
        item,
        minutes: minutes ?? 0,
      };
    })
    .filter((entry) => entry.minutes >= 30 || Boolean(entry.item.recentErrorCode))
    .sort((left, right) => right.minutes - left.minutes);

  const picked = candidates[0];
  if (!picked) {
    return null;
  }

  const region = getRegionById(picked.item.regionId);
  return {
    label: `${region ? region.nameEn.toUpperCase() : picked.item.regionId.toUpperCase()} 소스 수집`,
    delayMinutes: picked.minutes,
  };
}

export function HealthStrip({ hottestLabel, hottestHeat }: HealthStripProps) {
  const { data: regions } = useSWR<RegionsHealthResponse>("/regions/health", fetcher, {
    refreshInterval: 60_000,
  });
  const { data: analyzer } = useSWR<AnalyzerHealthResponse>("/analyzer/health", fetcher, {
    refreshInterval: 60_000,
  });
  const { data: sources } = useSWR<SourceHealthResponse>("/sources/health", fetcher, {
    refreshInterval: 60_000,
  });

  const freshnessMinutes = ageMinutes(regions?.latestSnapshotAt);
  const totalRegions = typeof regions?.totalRegions === "number" ? regions.totalRegions : null;
  const activeRegions = typeof regions?.activeRegions === "number" ? regions.activeRegions : null;
  const successRate = analyzer?.metrics?.geminiSuccessRate;
  const summaryCoverage =
    typeof successRate === "number" && Number.isFinite(successRate) && successRate > 0
      ? `${Math.round(successRate * 100)}%`
      : null;
  const delayedSource = pickDelayedSource(sources);

  const items: ReactNode[] = [];

  if (hottestLabel && typeof hottestHeat === "number" && Number.isFinite(hottestHeat)) {
    items.push(
      <span key="hot" className="truncate">
        가장 뜨거운 이슈: <span className="text-[var(--text-primary)]">{hottestLabel}</span> · heat {Math.round(hottestHeat)}
      </span>,
    );
  }

  if (typeof activeRegions === "number" && typeof totalRegions === "number" && totalRegions > 0) {
    items.push(<span key="regions">Active {activeRegions}/{totalRegions}</span>);
  }

  if (summaryCoverage) {
    items.push(<span key="coverage">Coverage {summaryCoverage}</span>);
  }

  if (delayedSource) {
    items.push(
      <span key="delay" className="text-amber-300">
        {delayedSource.label} {delayedSource.delayMinutes}분 지연
      </span>,
    );
  }

  if (freshnessMinutes !== null) {
    items.push(
      <span key="updated" className={freshnessClass(freshnessMinutes)}>
        updated {freshnessMinutes}m ago
      </span>,
    );
  }

  return (
    <div className="flex h-7 items-center gap-3 overflow-hidden rounded-lg border border-[var(--border-default)] bg-[rgba(10,14,23,0.88)] px-3 text-[11px] text-[var(--text-secondary)]">
      <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-emerald-300">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        LIVE
      </span>
      {items.length > 0 ? (
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          {items.map((item, index) => (
            <span key={`item-${index}`} className="truncate">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
