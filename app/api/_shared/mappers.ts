import type { GlobalTopic, Topic, TopicCategory, TopicEntity, TopicEntityType } from "@global-pulse/shared";
import { cleanupTopicName } from "@/lib/utils/topic-name";

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

function toOptionalNumberOrNull(value: unknown): number | null {
  const parsed = toOptionalNumber(value);
  return parsed === undefined ? null : parsed;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = toNumber(value, Number.NaN);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

const TOPIC_CATEGORIES = new Set<TopicCategory>([
  "politics",
  "economy",
  "tech",
  "entertainment",
  "sports",
  "society",
  "crime",
  "culture",
  "health",
  "science",
  "other",
]);

const TOPIC_ENTITY_TYPES = new Set<TopicEntityType>([
  "person",
  "org",
  "product",
  "event",
  "place",
  "work",
  "other",
]);

function toTopicCategory(value: unknown): TopicCategory | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase() as TopicCategory;
  return TOPIC_CATEGORIES.has(normalized) ? normalized : undefined;
}

function toTopicCategoryOrNull(value: unknown): TopicCategory | null {
  return toTopicCategory(value) ?? null;
}

function toTopicEntities(
  value: Array<{ text: string; type: string }> | null | undefined,
): TopicEntity[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const mapped = value
    .map((item) => {
      const text = item?.text?.trim();
      const rawType = item?.type?.trim().toLowerCase() as TopicEntityType;
      if (!text) {
        return null;
      }
      const type = TOPIC_ENTITY_TYPES.has(rawType) ? rawType : "other";
      return { text, type };
    })
    .filter((item): item is TopicEntity => Boolean(item));

  return mapped.length > 0 ? mapped : undefined;
}

function toTopicEntitiesOrNull(
  value: Array<{ text: string; type: string }> | null | undefined,
): TopicEntity[] | null {
  return toTopicEntities(value) ?? null;
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
  heat_score_display?: number | null;
  post_count: number | null;
  total_views: number | null;
  total_likes: number | null;
  total_comments: number | null;
  source_ids: string[] | null;
  raw_post_ids?: number[] | null;
  burst_z?: number | null;
  velocity_per_hour?: number | null;
  acceleration?: number | null;
  spread_score?: number | null;
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
  scope?: "community" | "news" | "mixed" | null;
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
  heat_score_display?: number | null;
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
  scope?: "community" | "news" | "mixed" | null;
  created_at?: string;
}

export function mapTopicRow(row: TopicRow): Topic {
  const cleaned = cleanupTopicName({
    id: row.id,
    regionId: row.region_id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    keywords: row.keywords ?? [],
    entities: row.entities ?? [],
  });

  return {
    id: toOptionalNumber(row.id),
    regionId: row.region_id,
    nameKo: cleaned.displayKo,
    nameEn: cleaned.displayEn,
    summaryKo: row.summary_ko ?? null,
    summaryEn: row.summary_en ?? null,
    sampleTitles: row.sample_titles ?? undefined,
    keywords: row.keywords ?? [],
    sentiment: toNullableNumber(row.sentiment),
    category: toTopicCategoryOrNull(row.category),
    entities: toTopicEntitiesOrNull(row.entities),
    aliases: row.aliases ?? null,
    canonicalKey: row.canonical_key ?? null,
    embeddingJson: row.embedding_json ?? undefined,
    heatScore: toNumber(row.heat_score),
    heatScoreDisplay: toOptionalNumberOrNull(row.heat_score_display),
    postCount: toNumber(row.post_count),
    totalViews: toNumber(row.total_views),
    totalLikes: toNumber(row.total_likes),
    totalComments: toNumber(row.total_comments),
    sourceIds: row.source_ids ?? [],
    rawPostIds: row.raw_post_ids ?? undefined,
    burstZ: toNullableNumber(row.burst_z),
    velocityPerHour: toOptionalNumberOrNull(row.velocity_per_hour),
    acceleration: toOptionalNumberOrNull(row.acceleration),
    spreadScore: toOptionalNumberOrNull(row.spread_score),
    propagationTimeline: row.propagation_timeline ?? null,
    propagationEdges: row.propagation_edges ?? null,
    scope: row.scope ?? undefined,
    rank: toOptionalNumber(row.rank),
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
}

export function mapGlobalTopicRow(row: GlobalTopicRow): GlobalTopic {
  const cleaned = cleanupTopicName({
    id: row.id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    keywords: [],
    entities: [],
  });

  return {
    id: toOptionalNumber(row.id),
    nameEn: cleaned.displayEn,
    nameKo: cleaned.displayKo,
    summaryEn: row.summary_en ?? null,
    summaryKo: row.summary_ko ?? null,
    regions: row.regions ?? [],
    regionalSentiments: row.regional_sentiments ?? {},
    regionalHeatScores: row.regional_heat_scores ?? {},
    topicIds: (row.topic_ids ?? []).map((id) => toNumber(id)),
    totalHeatScore: toNumber(row.total_heat_score),
    heatScoreDisplay: toOptionalNumberOrNull(row.heat_score_display),
    firstSeenRegion: row.first_seen_region ?? undefined,
    firstSeenAt: row.first_seen_at ?? undefined,
    propagationTimeline: row.propagation_timeline ?? null,
    propagationEdges: row.propagation_edges ?? null,
    velocityPerHour: toOptionalNumberOrNull(row.velocity_per_hour),
    acceleration: toOptionalNumberOrNull(row.acceleration),
    spreadScore: toOptionalNumberOrNull(row.spread_score),
    scope: row.scope ?? undefined,
  };
}
