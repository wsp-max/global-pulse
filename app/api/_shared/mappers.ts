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

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = toNumber(value, Number.NaN);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

export interface TopicRow {
  id: number;
  region_id: string;
  name_ko: string;
  name_en: string;
  summary_ko: string | null;
  summary_en: string | null;
  sample_titles?: string[] | null;
  keywords: string[] | null;
  sentiment: number | null;
  category?: string | null;
  entities?: Array<{ text: string; type: string }> | null;
  aliases?: string[] | null;
  canonical_key?: string | null;
  embedding_json?: number[] | null;
  heat_score: number | null;
  post_count: number | null;
  total_views: number | null;
  total_likes: number | null;
  total_comments: number | null;
  source_ids: string[] | null;
  raw_post_ids?: number[] | null;
  burst_z?: number | null;
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
  propagation_timeline?: Array<{
    regionId: string;
    firstPostAt: string;
    heatAtDiscovery: number;
    status?: "fading" | "steady" | "accelerating";
  }> | null;
  propagation_edges?: Array<{
    from: string;
    to: string;
    lagMinutes: number;
    confidence: number;
  }> | null;
  velocity_per_hour?: number | null;
  acceleration?: number | null;
  spread_score?: number | null;
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
    sampleTitles: row.sample_titles ?? undefined,
    keywords: row.keywords ?? [],
    sentiment: toNullableNumber(row.sentiment),
    category: row.category ?? undefined,
    entities: row.entities ?? undefined,
    aliases: row.aliases ?? undefined,
    canonicalKey: row.canonical_key ?? undefined,
    embeddingJson: row.embedding_json ?? undefined,
    heatScore: toNumber(row.heat_score),
    postCount: toNumber(row.post_count),
    totalViews: toNumber(row.total_views),
    totalLikes: toNumber(row.total_likes),
    totalComments: toNumber(row.total_comments),
    sourceIds: row.source_ids ?? [],
    rawPostIds: row.raw_post_ids ?? undefined,
    burstZ: toNullableNumber(row.burst_z),
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
    propagationTimeline: row.propagation_timeline ?? undefined,
    propagationEdges: row.propagation_edges ?? undefined,
    velocityPerHour: toOptionalNumber(row.velocity_per_hour),
    acceleration: toOptionalNumber(row.acceleration),
    spreadScore: toOptionalNumber(row.spread_score),
  };
}
