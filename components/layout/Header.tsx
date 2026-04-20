"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, GitCompareArrows } from "lucide-react";
import { useLanguage } from "@/lib/i18n/use-language";
import { HeaderClock } from "./HeaderClock";
import { SearchBar } from "./SearchBar";

export function Header() {
  const pathname = usePathname() || "/";
  const { lang, setLanguage, t } = useLanguage("ko");
  const keyRegions = ["Asia/Seoul", "Asia/Tokyo", "America/New_York"];

  const navLinks = [
    { href: "/", label: t("nav.dashboard") },
    { href: "/global-issues", label: t("nav.globalIssues") },
    { href: "/propagation", label: t("nav.propagation") },
    { href: "/timeline", label: t("nav.timeline") },
    { href: "/search", label: t("nav.search") },
    { href: "/compare", label: t("nav.compare") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[rgba(17,24,39,0.92)] backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-2 lg:px-6">
        <div className="flex min-h-[44px] items-center justify-between gap-3 lg:min-h-[56px]">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 font-display text-xs text-[var(--text-accent)] lg:text-sm"
            >
              GLOBAL PULSE
            </Link>
            <span className="hidden text-xs text-[var(--text-tertiary)] sm:inline">{t("app.subtitle")}</span>
          </div>

          <SearchBar />

          <div className="flex items-center gap-2">
            <HeaderClock keyRegions={keyRegions} />

            <Link
              href="/watchlist"
              aria-label="워치리스트 이동"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Bell className="h-3.5 w-3.5" />
            </Link>

            <Link
              href="/compare"
              aria-label="비교 화면 이동"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
            </Link>

            <div className="hidden h-7 items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] p-1 text-[10px] md:inline-flex">
              <button
                type="button"
                onClick={() => setLanguage("ko")}
                className={`rounded-full px-2 py-0.5 leading-none ${lang === "ko" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
                aria-label="Korean"
              >
                🇰🇷 {t("lang.ko")}
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`rounded-full px-2 py-0.5 leading-none ${lang === "en" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
                aria-label="English"
              >
                🇬🇧 {t("lang.en")}
              </button>
            </div>
          </div>
        </div>

        <nav className="mt-2 hidden h-9 items-center gap-1 overflow-x-auto text-[13px] text-[var(--text-secondary)] md:flex">
          {navLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-2 py-1 transition-colors ${
                  active
                    ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                    : "hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
