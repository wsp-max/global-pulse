"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, BarChart3, GitCompareArrows, Globe2, Home, Search, Share2 } from "lucide-react";
import type { ComponentType } from "react";
import { useLanguage } from "@/lib/i18n/use-language";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

export function MobileBottomNav() {
  const pathname = usePathname() || "/";
  const { t } = useLanguage("ko");

  const navItems: NavItem[] = [
    {
      href: "/",
      label: t("nav.dashboard"),
      icon: Home,
      match: (currentPathname) => currentPathname === "/",
    },
    {
      href: "/global-issues",
      label: t("nav.globalIssues"),
      icon: Globe2,
      match: (currentPathname) => currentPathname.startsWith("/global-issues"),
    },
    {
      href: "/propagation",
      label: t("nav.propagation"),
      icon: Share2,
      match: (currentPathname) => currentPathname.startsWith("/propagation"),
    },
    {
      href: "/source-transfer",
      label: t("nav.sourceTransfer"),
      icon: ArrowLeftRight,
      match: (currentPathname) => currentPathname.startsWith("/source-transfer"),
    },
    {
      href: "/timeline",
      label: t("nav.timeline"),
      icon: BarChart3,
      match: (currentPathname) => currentPathname.startsWith("/timeline"),
    },
    {
      href: "/search",
      label: t("nav.search"),
      icon: Search,
      match: (currentPathname) => currentPathname.startsWith("/search"),
    },
    {
      href: "/compare",
      label: t("nav.compare"),
      icon: GitCompareArrows,
      match: (currentPathname) => currentPathname.startsWith("/compare"),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-default)] bg-[rgba(10,14,23,0.95)] pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-7 gap-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center rounded-lg px-2 py-2 text-[11px] transition-colors ${
                  active
                    ? "bg-[var(--bg-tertiary)] text-[var(--text-accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="mt-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
