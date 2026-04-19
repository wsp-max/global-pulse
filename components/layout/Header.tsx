import Link from "next/link";
import { REGIONS } from "@global-pulse/shared";
import { HeaderClock } from "./HeaderClock";

const NAV_LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/global-issues", label: "글로벌 이슈" },
  { href: "/timeline", label: "타임라인" },
  { href: "/search", label: "검색" },
];

export function Header() {
  const keyRegions = ["Asia/Seoul", "Asia/Tokyo", "America/New_York"];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[rgba(17,24,39,0.92)] backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 font-display text-sm text-[var(--text-accent)]"
            >
              GLOBAL PULSE
            </Link>
            <span className="hidden text-xs text-[var(--text-tertiary)] sm:inline">
              Community Sentiment Monitor
            </span>
          </div>
          <HeaderClock keyRegions={keyRegions} activeRegions={REGIONS.length} />
        </div>

        <nav className="mt-3 hidden items-center gap-3 text-sm text-[var(--text-secondary)] md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2 py-1 transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
