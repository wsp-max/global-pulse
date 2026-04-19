"use client";

import { useEffect, useMemo, useState } from "react";

interface HeaderClockProps {
  keyRegions: string[];
}

type FreshnessLevel = "fresh" | "warning" | "critical" | "unknown";

interface RegionsHealthResponseShape {
  activeRegions?: number;
  latestSnapshotAt?: string | null;
  lastUpdated?: string;
}

interface GlobalTopicsResponseShape {
  lastUpdated?: string;
}

interface DashboardMeta {
  latestIso: string | null;
  activeRegions: number | null;
}

function normalizeBasePath(input?: string): string {
  const raw = input?.trim() ?? "";
  if (!raw) return "";
  return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
}

function runtimeBasePath(): string {
  const envBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  if (envBasePath) {
    return envBasePath;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return window.location.pathname === "/pulse" || window.location.pathname.startsWith("/pulse/")
    ? "/pulse"
    : "";
}

function formatTime(timezone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(now);
}

function toMillis(iso: string | null | undefined): number | null {
  if (!iso) {
    return null;
  }
  const parsed = new Date(iso).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function freshnessLevel(minutes: number | null): FreshnessLevel {
  if (minutes === null) return "unknown";
  if (minutes > 15) return "critical";
  if (minutes > 5) return "warning";
  return "fresh";
}

function freshnessClass(level: FreshnessLevel): string {
  if (level === "critical") {
    return "border-red-500/50 bg-red-500/10 text-red-300";
  }
  if (level === "warning") {
    return "border-amber-500/50 bg-amber-500/10 text-amber-300";
  }
  if (level === "fresh") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }
  return "border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]";
}

async function fetchDashboardMeta(basePath: string): Promise<DashboardMeta> {
  try {
    const [regionsHealthRes, globalRes] = await Promise.all([
      fetch(`${basePath}/api/regions/health`, { cache: "no-store" }),
      fetch(`${basePath}/api/global-topics?limit=1`, { cache: "no-store" }),
    ]);

    const timestamps: number[] = [];
    let activeRegions: number | null = null;

    if (regionsHealthRes.ok) {
      const regionsHealth = (await regionsHealthRes.json()) as RegionsHealthResponseShape;
      activeRegions = typeof regionsHealth.activeRegions === "number" ? regionsHealth.activeRegions : null;

      const healthLastUpdated = toMillis(regionsHealth.lastUpdated);
      if (healthLastUpdated !== null) {
        timestamps.push(healthLastUpdated);
      }

      const latestSnapshotAt = toMillis(regionsHealth.latestSnapshotAt);
      if (latestSnapshotAt !== null) {
        timestamps.push(latestSnapshotAt);
      }
    }

    if (globalRes.ok) {
      const globalData = (await globalRes.json()) as GlobalTopicsResponseShape;
      const globalUpdated = toMillis(globalData.lastUpdated);
      if (globalUpdated !== null) {
        timestamps.push(globalUpdated);
      }
    }

    return {
      latestIso: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null,
      activeRegions,
    };
  } catch {
    return { latestIso: null, activeRegions: null };
  }
}

export function HeaderClock({ keyRegions }: HeaderClockProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [latestIso, setLatestIso] = useState<string | null>(null);
  const [activeRegions, setActiveRegions] = useState<number | null>(null);

  useEffect(() => {
    const mountTimer = setTimeout(() => {
      setMounted(true);
      setNow(Date.now());
    }, 0);

    const tickTimer = setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      clearTimeout(mountTimer);
      clearInterval(tickTimer);
    };
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let cancelled = false;
    const basePath = runtimeBasePath();

    const load = async () => {
      const result = await fetchDashboardMeta(basePath);
      if (!cancelled) {
        setLatestIso(result.latestIso);
        setActiveRegions(result.activeRegions);
      }
    };

    void load();
    const refreshTimer = setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, [mounted]);

  const currentDate = useMemo(() => (now === null ? null : new Date(now)), [now]);
  const freshnessMinutes = useMemo(() => {
    if (now === null) {
      return null;
    }
    const latest = toMillis(latestIso);
    if (latest === null) {
      return null;
    }
    return Math.max(0, Math.floor((now - latest) / 60_000));
  }, [latestIso, now]);

  const level = freshnessLevel(freshnessMinutes);
  const freshnessText = freshnessMinutes === null ? "갱신 정보 없음" : `갱신 ${freshnessMinutes}분 전`;
  const freshnessAriaLabel =
    freshnessMinutes === null ? "마지막 갱신 정보를 확인할 수 없음" : `마지막 갱신 ${freshnessMinutes}분 전`;

  return (
    <div className="hidden items-center gap-4 text-xs text-[var(--text-secondary)] lg:flex">
      {keyRegions.map((timezone) => (
        <span key={timezone}>
          {timezone}: {mounted && currentDate ? formatTime(timezone, currentDate) : "--:--"}
        </span>
      ))}
      <span>Active Regions: {activeRegions === null || activeRegions === 0 ? "데이터 준비 중" : activeRegions}</span>
      <span aria-label={freshnessAriaLabel} className={`rounded-full border px-2 py-1 ${freshnessClass(level)}`}>
        {freshnessText}
      </span>
    </div>
  );
}
