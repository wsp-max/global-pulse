import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardClient } from "@/components/dashboard";
import type { GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeBasePath(input?: string): string {
  const raw = input?.trim() ?? "";
  if (!raw) return "";
  return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
}

async function detectRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return appUrl.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

async function fetchServerJson<T>(path: string): Promise<T | null> {
  try {
    const origin = await detectRequestOrigin();
    const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
    const response = await fetch(`${origin}${basePath}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default async function NewsDashboardPage() {
  if (process.env.FEATURE_DUAL_MAP_UI !== "true") {
    notFound();
  }

  const [regionsData, globalTopicsData] = await Promise.all([
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=news"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=news&limit=20"),
  ]);

  return (
    <DashboardClient
      scope="news"
      initialRegions={regionsData ?? undefined}
      initialGlobalTopics={globalTopicsData ?? undefined}
    />
  );
}
