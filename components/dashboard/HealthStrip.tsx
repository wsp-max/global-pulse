"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";

interface RegionsHealthResponse {
  activeRegions?: number;
  totalRegions?: number;
  latestSnapshotAt?: string | null;
}

interface SourceHealthResponse {
  summary?: {
    collectionCoveragePct?: number;
    recoveryNeededSources?: number;
    optionalBlockedSources?: number;
  };
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

export function HealthStrip({ hottestLabel, hottestHeat }: HealthStripProps) {
  const { data: regions } = useSWR<RegionsHealthResponse>("/regions/health", fetcher, {
    refreshInterval: 60_000,
  });
  const { data: sources } = useSWR<SourceHealthResponse>("/sources/health", fetcher, {
    refreshInterval: 60_000,
  });

  const freshnessMinutes = ageMinutes(regions?.latestSnapshotAt);
  const totalRegions = typeof regions?.totalRegions === "number" ? regions.totalRegions : null;
  const activeRegions = typeof regions?.activeRegions === "number" ? regions.activeRegions : null;
  const collectionCoverage =
    typeof sources?.summary?.collectionCoveragePct === "number"
      ? `${Math.round(sources.summary.collectionCoveragePct)}%`
      : null;
  const recoveryNeeded =
    typeof sources?.summary?.recoveryNeededSources === "number"
      ? sources.summary.recoveryNeededSources
      : null;
  const optionalBlocked =
    typeof sources?.summary?.optionalBlockedSources === "number"
      ? sources.summary.optionalBlockedSources
      : null;

  const items: ReactNode[] = [];

  if (hottestLabel && typeof hottestHeat === "number" && Number.isFinite(hottestHeat)) {
    items.push(
      <span key="hot" className="truncate">
        가장 뜨거운 이슈: <span className="text-[var(--text-primary)]">{hottestLabel}</span> · heat {Math.round(hottestHeat)}
      </span>,
    );
  }

  if (typeof activeRegions === "number" && typeof totalRegions === "number" && totalRegions > 0) {
    items.push(<span key="regions">Active regions {activeRegions}/{totalRegions}</span>);
  }

  if (collectionCoverage) {
    items.push(<span key="coverage">수집 커버리지 {collectionCoverage}</span>);
  }

  if (typeof recoveryNeeded === "number") {
    items.push(<span key="recovery">복구 필요 {recoveryNeeded} sources</span>);
  }

  if (typeof optionalBlocked === "number") {
    items.push(<span key="optional">Reddit optional blocked {optionalBlocked}</span>);
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
