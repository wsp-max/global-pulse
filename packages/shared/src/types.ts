export interface Region {
  id: string;
  nameKo: string;
  nameEn: string;
  flagEmoji: string;
  timezone: string;
  color: string;
  isActive: boolean;
  sortOrder?: number;
}

export interface Source {
  id: string;
  regionId: string;
  name: string;
  nameEn: string;
  url: string;
  type: "community" | "sns" | "news";
  scrapeUrl: string;
  scrapeIntervalMinutes: number;
  isActive?: boolean;
  newsCategory?:
    | "wire_service"
    | "newspaper"
    | "broadcaster"
    | "portal"
    | "business_media"
    | "tech_media"
    | "tabloid"
    | "magazine"
    | "local_news";
  trustTier?: 1 | 2 | 3;
  language?: string;
  feedKind?: "rss" | "atom" | "json" | "html_ranking";
  rankingHint?: string;
  metroHint?: string | null;
}

export interface RawPost {
  id?: number;
  sourceId: string;
  externalId: string;
  title: string;
  bodyPreview?: string;
  url?: string;
  author?: string;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  collectedAt: string;
  postedAt?: string;
}

export interface Topic {
  id?: number;
  regionId: string;
  nameKo: string;
  nameEn: string;
  summaryKo?: string | null;
  summaryEn?: string | null;
  sampleTitles?: string[];
  keywords: string[];
  sentiment: number | null;
  sentimentDistribution?: {
    positive: number;
    negative: number;
    neutral: number;
    controversial: number;
  } | null;
  sentimentReasoningKo?: string | null;
  sentimentReasoningEn?: string | null;
  anomalyScore?: number | null;
  heatScore: number;
  heatScoreDisplay?: number | null;
  postCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  sourceIds: string[];
  rawPostIds?: number[];
  category?: TopicCategory | null;
  entities?: TopicEntity[] | null;
  aliases?: string[] | null;
  canonicalKey?: string | null;
  embeddingJson?: number[] | null;
  burstZ?: number | null;
  lifecycleStage?: "emerging" | "peaking" | "fading" | null;
  miniTrend?: number[] | null;
  sourceDiversity?: number | null;
  dominantSourceShare?: number | null;
  velocityPerHour?: number | null;
  acceleration?: number | null;
  spreadScore?: number | null;
  propagationTimeline?: Array<{
    regionId: string;
    firstPostAt: string;
    heatAtDiscovery: number;
    status?: "fading" | "steady" | "accelerating";
  }> | null;
  propagationEdges?: Array<{
    from: string;
    to: string;
    lagMinutes: number;
    confidence: number;
  }> | null;
  scope?: "community" | "news" | "mixed";
  rank?: number;
  periodStart: string;
  periodEnd: string;
}

export type TopicCategory =
  | "politics"
  | "economy"
  | "tech"
  | "entertainment"
  | "sports"
  | "society"
  | "crime"
  | "culture"
  | "health"
  | "science"
  | "other";

export type TopicEntityType = "person" | "org" | "product" | "event" | "place" | "work" | "other";

export interface TopicEntity {
  text: string;
  type: TopicEntityType;
}

export interface GlobalTopic {
  id?: number;
  nameEn: string;
  nameKo: string;
  summaryEn?: string | null;
  summaryKo?: string | null;
  regions: string[];
  regionalSentiments: Record<string, number>;
  regionalHeatScores: Record<string, number>;
  topicIds: number[];
  totalHeatScore: number;
  heatScoreDisplay?: number | null;
  firstSeenRegion?: string | null;
  firstSeenAt?: string | null;
  propagationTimeline?: Array<{
    regionId: string;
    firstPostAt: string;
    heatAtDiscovery: number;
    status?: "fading" | "steady" | "accelerating";
  }> | null;
  propagationEdges?: Array<{
    from: string;
    to: string;
    lagMinutes: number;
    confidence: number;
  }> | null;
  velocityPerHour?: number | null;
  acceleration?: number | null;
  spreadScore?: number | null;
  scope?: "community" | "news" | "mixed";
}

export interface HeatHistory {
  regionId: string;
  topicName: string;
  heatScore: number;
  sentiment: number;
  postCount: number;
  recordedAt: string;
}

export interface RegionSnapshot {
  regionId: string;
  totalHeatScore: number;
  activeTopics: number;
  avgSentiment: number;
  topKeywords: string[];
  sourcesActive: number;
  sourcesTotal: number;
  snapshotAt: string;
  scope?: "community" | "news" | "mixed";
}

export interface ScrapedPost {
  externalId: string;
  title: string;
  bodyPreview?: string;
  url?: string;
  author?: string;
  viewCount?: number;
  likeCount?: number;
  dislikeCount?: number;
  commentCount?: number;
  postedAt?: string;
  rank?: number;
}

export interface ScraperResult {
  sourceId: string;
  posts: ScrapedPost[];
  scrapedAt: string;
  success: boolean;
  error?: string;
}

export type HeatLevel = "cold" | "warm" | "hot" | "fire" | "explosive";

export function getHeatLevel(score: number): HeatLevel {
  if (score < 100) return "cold";
  if (score < 300) return "warm";
  if (score < 600) return "hot";
  if (score < 1000) return "fire";
  return "explosive";
}

export const HEAT_COLORS: Record<HeatLevel, string> = {
  cold: "#6B7280",
  warm: "#F59E0B",
  hot: "#F97316",
  fire: "#EF4444",
  explosive: "#DC2626",
};

export const SENTIMENT_COLORS = {
  positive: "#10B981",
  neutral: "#6B7280",
  negative: "#EF4444",
};




