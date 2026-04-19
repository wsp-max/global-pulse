import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import type { TopicDetailApiResponse } from "@/lib/types/api";

export const alt = "Global Pulse Topic";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

interface TopicOgProps {
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

export default async function TopicOpenGraphImage({ params }: TopicOgProps) {
  const { topicId } = await params;
  const detail = await fetchTopicDetail(topicId);

  const title =
    detail?.topic?.nameKo ||
    detail?.topic?.nameEn ||
    detail?.globalTopic?.nameKo ||
    detail?.globalTopic?.nameEn ||
    `Topic ${topicId}`;
  const region = detail?.topic?.regionId?.toUpperCase() ?? (detail?.globalTopic?.regions?.join(" · ") ?? "GLOBAL");
  const heat = detail?.topic?.heatScore ?? detail?.globalTopic?.totalHeatScore ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "linear-gradient(135deg, #0b1220 0%, #10263d 48%, #1b3b52 100%)",
          color: "#f8fafc",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "10px 18px",
            borderRadius: "999px",
            border: "1px solid rgba(148,163,184,0.3)",
            fontSize: 22,
            letterSpacing: "0.08em",
          }}
        >
          GLOBAL PULSE
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.1, maxWidth: "92%" }}>{title}</div>
          <div style={{ display: "flex", gap: 24, fontSize: 28 }}>
            <span>Region {region}</span>
            <span>Heat {Math.round(heat)}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
