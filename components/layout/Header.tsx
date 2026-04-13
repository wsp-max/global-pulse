import Link from "next/link";
import { REGIONS } from "@global-pulse/shared";

function formatTime(timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date());
}

export function Header() {
  const keyRegions = ["Asia/Seoul", "Asia/Tokyo", "America/New_York"];

  return (
    <header className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 font-display text-sm text-[var(--text-accent)]">
            GLOBAL PULSE
          </div>
          <nav className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Link href="/">Dashboard</Link>
            <Link href="/global-issues">Global Issues</Link>
            <Link href="/timeline">Timeline</Link>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
          {keyRegions.map((timezone) => (
            <span key={timezone}>
              {timezone}: {formatTime(timezone)}
            </span>
          ))}
          <span>
            Last Update: {new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}
          </span>
          <span>Active Regions: {REGIONS.length}</span>
        </div>
      </div>
    </header>
  );
}


