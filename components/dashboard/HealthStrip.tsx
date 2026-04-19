"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api";

interface RegionsHealthResponse {
  activeRegions: number;
  totalRegions: number;
  latestSnapshotAt: string | null;
}

interface SourcesHealthResponse {
  healthySources: number;
  totalSources: number;
  autoDisabledSources24h?: number;
}

interface AnalyzerHealthResponse {
  metrics?: {
    geminiSuccessRate?: number;
  };
}

function freshnessColor(minutes: number | null): string {
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

function freshnessIcon(minutes: number | null): string {
  if (minutes === null) {
    return "⚪";
  }
  if (minutes <= 5) {
    return "🟢";
  }
  if (minutes <= 30) {
    return "🟠";
  }
  return "🔴";
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

export function HealthStrip() {
  const { data: regions } = useSWR<RegionsHealthResponse>("/regions/health", fetcher, {
    refreshInterval: 60_000,
  });
  const { data: sources } = useSWR<SourcesHealthResponse>("/sources/health", fetcher, {
    refreshInterval: 60_000,
  });
  const { data: analyzer } = useSWR<AnalyzerHealthResponse>("/analyzer/health", fetcher, {
    refreshInterval: 60_000,
  });

  const freshnessMinutes = ageMinutes(regions?.latestSnapshotAt);
  const coverage = Math.round(((analyzer?.metrics?.geminiSuccessRate ?? 0) * 100));
  const autoDisabledCount = sources?.autoDisabledSources24h ?? 0;

  return (
    <Link
      href="/admin/health"
      className="sticky top-[62px] z-30 block border-b border-[var(--border-default)] bg-[rgba(10,14,23,0.95)] px-4 py-1.5 text-[11px] backdrop-blur lg:px-6"
      aria-label="수집 건강도 상세 보기"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 text-[var(--text-secondary)]">
        <span className={`${freshnessColor(freshnessMinutes)} font-medium`}>
          {freshnessIcon(freshnessMinutes)} LIVE · updated {freshnessMinutes ?? "-"}m ago
        </span>
        <span>
          Regions: {regions?.activeRegions ?? 0}/{regions?.totalRegions ?? 0} active
        </span>
        <span>
          Sources: {sources?.healthySources ?? 0}/{sources?.totalSources ?? 0} healthy
        </span>
        <span>Gemini: {coverage}% summary coverage</span>
        {autoDisabledCount > 0 ? (
          <span className="rounded-full border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-red-300">
            auto-disabled {autoDisabledCount}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
