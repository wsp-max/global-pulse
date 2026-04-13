import type { GlobalTopic, Topic } from "@global-pulse/shared";

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = toNumber(value, Number.NaN);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

export interface TopicRow {
  id: number;
  region_id: string;
  name_ko: string;
  name_en: string;
  summary_ko: string | null;
  summary_en: string | null;
  keywords: string[] | null;
  sentiment: number | null;
  heat_score: number | null;
  post_count: number | null;
  total_views: number | null;
  total_likes: number | null;
  total_comments: number | null;
  source_ids: string[] | null;
  rank: number | null;
  period_start: string;
  period_end: string;
  created_at?: string;
}

export interface GlobalTopicRow {
  id: number;
  name_en: string;
  name_ko: string;
  summary_en: string | null;
  summary_ko: string | null;
  regions: string[] | null;
  regional_sentiments: Record<string, number> | null;
  regional_heat_scores: Record<string, number> | null;
  topic_ids: number[] | null;
  total_heat_score: number | null;
  first_seen_region: string | null;
  first_seen_at: string | null;
  created_at?: string;
}

export function mapTopicRow(row: TopicRow): Topic {
  return {
    id: toOptionalNumber(row.id),
    regionId: row.region_id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    summaryKo: row.summary_ko ?? undefined,
    summaryEn: row.summary_en ?? undefined,
    keywords: row.keywords ?? [],
    sentiment: toNumber(row.sentiment),
    heatScore: toNumber(row.heat_score),
    postCount: toNumber(row.post_count),
    totalViews: toNumber(row.total_views),
    totalLikes: toNumber(row.total_likes),
    totalComments: toNumber(row.total_comments),
    sourceIds: row.source_ids ?? [],
    rank: toOptionalNumber(row.rank),
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
}

export function mapGlobalTopicRow(row: GlobalTopicRow): GlobalTopic {
  return {
    id: toOptionalNumber(row.id),
    nameEn: row.name_en,
    nameKo: row.name_ko,
    summaryEn: row.summary_en ?? undefined,
    summaryKo: row.summary_ko ?? undefined,
    regions: row.regions ?? [],
    regionalSentiments: row.regional_sentiments ?? {},
    regionalHeatScores: row.regional_heat_scores ?? {},
    topicIds: (row.topic_ids ?? []).map((id) => toNumber(id)),
    totalHeatScore: toNumber(row.total_heat_score),
    firstSeenRegion: row.first_seen_region ?? undefined,
    firstSeenAt: row.first_seen_at ?? undefined,
  };
}
