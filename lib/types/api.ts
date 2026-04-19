import type { GlobalTopic, Region, Topic } from "@global-pulse/shared";

export type DashboardScope = "community" | "news" | "mixed";

export interface RegionSnapshotApi {
  region_id?: string;
  total_heat_score?: number;
  active_topics?: number;
  avg_sentiment?: number;
  top_keywords?: string[];
  sources_active?: number;
  sources_total?: number;
  snapshot_at?: string;
  scope?: DashboardScope;
}

export interface TopicsApiResponse {
  topics: Topic[];
  total: number;
  region: Region | null;
  snapshot: RegionSnapshotApi | null;
  scope?: DashboardScope;
  configured?: boolean;
  lastUpdated?: string;
}

export interface RegionDashboardRow extends Region {
  totalHeatScore: number;
  activeTopics: number;
  avgSentiment: number;
  topKeywords: string[];
  sourcesActive: number;
  sourcesTotal: number;
  snapshotAt?: string | null;
  scope?: DashboardScope;
  dataState?: "fresh" | "stale" | "empty" | "partially-stale";
  supplementedFromHistory?: number;
  topTopics: Topic[];
}

export interface RegionsApiResponse {
  regions: RegionDashboardRow[];
  scope?: DashboardScope;
  configured?: boolean;
  lastUpdated?: string;
}

export interface GlobalTopicsApiResponse {
  globalTopics: GlobalTopic[];
  total: number;
  scope?: DashboardScope;
  configured?: boolean;
  lastUpdated?: string;
}

export interface TimelinePoint {
  regionId: string;
  topicName: string;
  heatScore: number;
  sentiment: number;
  postCount: number;
  recordedAt: string;
}

export interface TimelineApiResponse {
  timeline: TimelinePoint[];
  topic: string;
  region: string | null;
  hours: number;
  regions: string[];
  configured?: boolean;
}

export type TopicDetailKind = "global" | "regional" | "not_configured";

export interface TopicDetailApiResponse {
  kind: TopicDetailKind;
  topicId: number;
  globalTopic: GlobalTopic | null;
  topic: Topic | null;
  regionalTopics: Topic[];
  relatedTopics: Topic[];
  relatedGlobalTopics: GlobalTopic[];
  timeline: TimelinePoint[];
  keywords: string[];
  configured?: boolean;
  lastUpdated?: string;
}

export interface RegionCompareApiResponse {
  regionId: string;
  community: RegionDashboardRow | null;
  news: RegionDashboardRow | null;
  overlap: {
    sharedTopicCount: number;
    sharedCanonicalKeys: string[];
    lagSummary: {
      avgMinutes: number | null;
      minMinutes: number | null;
      maxMinutes: number | null;
    };
  };
  configured?: boolean;
  lastUpdated?: string;
}

export interface PortalRankingRow {
  id: number;
  sourceId: string;
  regionId: string;
  rank: number;
  headline: string;
  url?: string | null;
  viewCount?: number | null;
  capturedAt: string;
}

export interface PortalRankingsApiResponse {
  regionId: string;
  limit: number;
  rankings: PortalRankingRow[];
  configured?: boolean;
  lastUpdated?: string;
}

export interface IssueOverlapRow {
  id: number;
  canonicalKey: string | null;
  cosine: number | null;
  lagMinutes: number | null;
  leader: "community" | "news" | "tie" | null;
  detectedAt: string;
  regionId: string;
  communityTopic: {
    id: number;
    nameKo: string;
    nameEn: string;
    rank?: number | null;
  };
  newsTopic: {
    id: number;
    nameKo: string;
    nameEn: string;
    rank?: number | null;
  };
}

export interface IssueOverlapsApiResponse {
  minTier: number;
  limit: number;
  overlaps: IssueOverlapRow[];
  configured?: boolean;
  lastUpdated?: string;
}

export interface PropagationMatrixCell {
  fromRegion: string;
  toRegion: string;
  edgeCount: number;
  avgLagMinutes: number | null;
  sampleTopics: string[];
}

export interface PropagationMatrixInsight {
  fromRegion: string;
  toRegion: string;
  share: number;
  avgLagHours: number | null;
  text: string;
}

export interface PropagationMatrixApiResponse {
  scope: DashboardScope;
  days: number;
  regions: string[];
  cells: PropagationMatrixCell[];
  insight: PropagationMatrixInsight | null;
  configured?: boolean;
  provider?: "postgres" | "none";
  lastUpdated?: string;
}
