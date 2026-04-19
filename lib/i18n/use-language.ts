"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  I18N_MESSAGES,
  LANGUAGE_COOKIE_KEY,
  normalizeLanguage,
  type AppLanguage,
  type I18nMessageKey,
} from "@/lib/i18n/dictionary";

function readCookieLang(): AppLanguage | null {
  if (typeof document === "undefined") {
    return null;
  }
  const matches = document.cookie.match(new RegExp(`${LANGUAGE_COOKIE_KEY}=([^;]+)`));
  if (!matches?.[1]) {
    return null;
  }
  return normalizeLanguage(decodeURIComponent(matches[1]));
}

export function useLanguage(defaultLang: AppLanguage = "ko") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const lang = useMemo(() => {
    const fromQuery = normalizeLanguage(searchParams.get("lang"));
    if (fromQuery) {
      return fromQuery;
    }

    const fromCookie = readCookieLang();
    if (fromCookie) {
      return fromCookie;
    }

    return defaultLang;
  }, [defaultLang, searchParams]);

  const setLanguage = (nextLang: AppLanguage) => {
    if (typeof document !== "undefined") {
      document.cookie = `${LANGUAGE_COOKIE_KEY}=${encodeURIComponent(nextLang)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("lang", nextLang);
    const nextUrl = `${pathname}?${nextParams.toString()}`;
    router.replace(nextUrl, { scroll: false });
  };

  const t = (key: I18nMessageKey): string => I18N_MESSAGES[lang][key] ?? I18N_MESSAGES.ko[key];

  return {
    lang,
    setLanguage,
    t,
  };
}
