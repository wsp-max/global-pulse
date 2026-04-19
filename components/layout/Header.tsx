import Link from "next/link";
import { HeaderClock } from "./HeaderClock";

const BASE_NAV_LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/global-issues", label: "글로벌 이슈" },
  { href: "/timeline", label: "타임라인" },
  { href: "/search", label: "검색" },
];

export function Header() {
  const keyRegions = ["Asia/Seoul", "Asia/Tokyo", "America/New_York"];
  const dualMapEnabled = process.env.FEATURE_DUAL_MAP_UI === "true";
  const navLinks = dualMapEnabled
    ? [
        ...BASE_NAV_LINKS,
        { href: "/news", label: "뉴스 트랙" },
        { href: "/compare", label: "커뮤 vs 뉴스" },
      ]
    : BASE_NAV_LINKS;

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
          <HeaderClock keyRegions={keyRegions} />
        </div>

        <nav className="mt-3 hidden items-center gap-3 text-sm text-[var(--text-secondary)] md:flex">
          {navLinks.map((link) => (
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
