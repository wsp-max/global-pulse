"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/use-language";
import { HeaderClock } from "./HeaderClock";
import { SearchBar } from "./SearchBar";

export function Header() {
  const { lang, setLanguage, t } = useLanguage("ko");
  const keyRegions = ["Asia/Seoul", "Asia/Tokyo", "America/New_York"];
  const dualMapEnabled = process.env.NEXT_PUBLIC_FEATURE_DUAL_MAP_UI === "true";
  const navLinks = dualMapEnabled
    ? [
        { href: "/", label: t("nav.dashboard") },
        { href: "/global-issues", label: t("nav.globalIssues") },
        { href: "/timeline", label: t("nav.timeline") },
        { href: "/search", label: t("nav.search") },
        { href: "/news", label: t("nav.news") },
        { href: "/compare", label: t("nav.compare") },
      ]
    : [
        { href: "/", label: t("nav.dashboard") },
        { href: "/global-issues", label: t("nav.globalIssues") },
        { href: "/timeline", label: t("nav.timeline") },
        { href: "/search", label: t("nav.search") },
      ];

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
            <span className="hidden text-xs text-[var(--text-tertiary)] sm:inline">{t("app.subtitle")}</span>
          </div>

          <SearchBar />

          <div className="flex items-center gap-2">
            <HeaderClock keyRegions={keyRegions} />
            <div className="hidden items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] p-1 text-[10px] md:inline-flex">
              <button
                type="button"
                onClick={() => setLanguage("ko")}
                className={`rounded-full px-2 py-0.5 ${lang === "ko" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
                aria-label="Korean"
              >
                🇰🇷 {t("lang.ko")}
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`rounded-full px-2 py-0.5 ${lang === "en" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
                aria-label="English"
              >
                🇬🇧 {t("lang.en")}
              </button>
            </div>
          </div>
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
