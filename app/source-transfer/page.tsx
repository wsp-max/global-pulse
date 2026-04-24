import { SourceTransferPageClient } from "@/components/dashboard/SourceTransferPageClient";
import { fetchServerJson } from "@/lib/server/fetch-json";
import type { SourceTransferApiResponse, SourceTransferDirection } from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SourceTransferPageProps {
  searchParams: Promise<{
    direction?: string;
    hours?: string;
    region?: string;
    limit?: string;
    offset?: string;
  }>;
}

function parseDirection(value: string | undefined): SourceTransferDirection {
  if (value === "news_to_community" || value === "both") {
    return value;
  }
  return "community_to_news";
}

function parseHours(value: string | undefined): number {
  const parsed = Number(value ?? 24);
  if (!Number.isFinite(parsed)) return 24;
  return Math.max(1, Math.min(Math.trunc(parsed), 168));
}

function parseLimit(value: string | undefined): number {
  const parsed = Number(value ?? 30);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(Math.trunc(parsed), 200));
}

function parseOffset(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function parseRegion(value: string | undefined): string {
  const raw = (value ?? "all").trim().toLowerCase();
  if (!raw) return "all";
  return raw;
}

export default async function SourceTransferPage({ searchParams }: SourceTransferPageProps) {
  const params = await searchParams;
  const direction = parseDirection(params.direction);
  const hours = parseHours(params.hours);
  const region = parseRegion(params.region);
  const limit = parseLimit(params.limit);
  const offset = parseOffset(params.offset);

  const initialData = await fetchServerJson<SourceTransferApiResponse>(
    `/api/analytics/source-transfer?direction=${direction}&hours=${hours}&region=${region}&limit=${limit}&offset=${offset}`,
  );

  return (
    <SourceTransferPageClient
      initialDirection={direction}
      initialHours={hours}
      initialRegion={region}
      initialLimit={limit}
      initialOffset={offset}
      initialData={initialData ?? undefined}
    />
  );
}
