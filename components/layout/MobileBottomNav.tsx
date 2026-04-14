"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Globe2, Home, Search } from "lucide-react";
import type { ComponentType } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "홈",
    icon: Home,
    match: (pathname) => pathname === "/",
  },
  {
    href: "/global-issues",
    label: "글로벌",
    icon: Globe2,
    match: (pathname) => pathname.startsWith("/global-issues"),
  },
  {
    href: "/timeline",
    label: "타임라인",
    icon: BarChart3,
    match: (pathname) => pathname.startsWith("/timeline"),
  },
  {
    href: "/search",
    label: "검색",
    icon: Search,
    match: (pathname) => pathname.startsWith("/search"),
  },
];

export function MobileBottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-default)] bg-[rgba(10,14,23,0.95)] pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-4 gap-1 px-2">
        {NAV_ITEMS.map((item) => {
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
