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
  type: "community" | "sns";
  scrapeUrl: string;
  scrapeIntervalMinutes: number;
  isActive?: boolean;
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
  summaryKo?: string;
  summaryEn?: string;
  sampleTitles?: string[];
  keywords: string[];
  sentiment: number | null;
  heatScore: number;
  postCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  sourceIds: string[];
  rawPostIds?: number[];
  category?: TopicCategory;
  entities?: TopicEntity[];
  aliases?: string[];
  canonicalKey?: string;
  embeddingJson?: number[] | null;
  burstZ?: number | null;
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
  summaryEn?: string;
  summaryKo?: string;
  regions: string[];
  regionalSentiments: Record<string, number>;
  regionalHeatScores: Record<string, number>;
  topicIds: number[];
  totalHeatScore: number;
  firstSeenRegion?: string;
  firstSeenAt?: string;
  propagationTimeline?: Array<{
    regionId: string;
    firstPostAt: string;
    heatAtDiscovery: number;
    status?: "fading" | "steady" | "accelerating";
  }>;
  propagationEdges?: Array<{
    from: string;
    to: string;
    lagMinutes: number;
    confidence: number;
  }>;
  velocityPerHour?: number;
  acceleration?: number;
  spreadScore?: number;
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

