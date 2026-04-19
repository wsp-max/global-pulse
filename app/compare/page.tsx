import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DualCompareClient } from "@/components/dashboard";
import type {
  GlobalTopicsApiResponse,
  IssueOverlapsApiResponse,
  RegionsApiResponse,
} from "@/lib/types/api";

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

export default async function ComparePage() {
  if (process.env.FEATURE_DUAL_MAP_UI !== "true") {
    notFound();
  }

  const [communityRegions, newsRegions, communityGlobal, newsGlobal, overlaps] = await Promise.all([
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=community"),
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=news"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=community&limit=20"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=news&limit=20"),
    fetchServerJson<IssueOverlapsApiResponse>("/api/issue-overlaps?limit=20&minTier=2"),
  ]);

  return (
    <DualCompareClient
      initialCommunityRegions={communityRegions ?? undefined}
      initialNewsRegions={newsRegions ?? undefined}
      initialCommunityGlobalTopics={communityGlobal ?? undefined}
      initialNewsGlobalTopics={newsGlobal ?? undefined}
      initialOverlaps={overlaps ?? undefined}
    />
  );
}
