import type { Metadata } from "next";
import { headers } from "next/headers";
import { TopicPageClient } from "@/components/topic/TopicPageClient";
import type { TopicDetailApiResponse } from "@/lib/types/api";

interface TopicPageProps {
  params: Promise<{ topicId: string }>;
}

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

async function fetchTopicDetail(topicId: string): Promise<TopicDetailApiResponse | null> {
  try {
    const origin = await detectRequestOrigin();
    const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
    const response = await fetch(`${origin}${basePath}/api/topic/${topicId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as TopicDetailApiResponse;
  } catch {
    return null;
  }
}

function normalizeSummary(text: string | undefined | null): string {
  const raw = (text ?? "").trim();
  if (!raw) {
    return "요약 준비 중";
  }
  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { topicId } = await params;
  const detail = await fetchTopicDetail(topicId);
  const origin = await detectRequestOrigin();
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

  const fallbackTitle = `Topic ${topicId} | Global Pulse`;

  if (!detail || detail.kind === "not_configured") {
    return {
      title: fallbackTitle,
      description: "Global Pulse topic detail",
    };
  }

  const titleSource =
    detail.topic?.nameKo ||
    detail.topic?.nameEn ||
    detail.globalTopic?.nameKo ||
    detail.globalTopic?.nameEn ||
    `Topic ${topicId}`;
  const summarySource =
    detail.topic?.summaryKo ||
    detail.topic?.summaryEn ||
    detail.globalTopic?.summaryKo ||
    detail.globalTopic?.summaryEn ||
    "요약 준비 중";

  const title = `${titleSource} | Global Pulse`;
  const description = normalizeSummary(summarySource);
  const imageUrl = `${origin}${basePath}/topic/${topicId}/opengraph-image`;
  const pageUrl = `${origin}${basePath}/topic/${topicId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      images: [imageUrl],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { topicId } = await params;

  return <TopicPageClient topicId={topicId} />;
}
