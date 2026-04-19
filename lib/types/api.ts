import type { GlobalTopic, Region, Topic } from "@global-pulse/shared";

export interface RegionSnapshotApi {
  region_id?: string;
  total_heat_score?: number;
  active_topics?: number;
  avg_sentiment?: number;
  top_keywords?: string[];
  sources_active?: number;
  sources_total?: number;
  snapshot_at?: string;
}

export interface TopicsApiResponse {
  topics: Topic[];
  total: number;
  region: Region | null;
  snapshot: RegionSnapshotApi | null;
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
  topTopics: Topic[];
}

export interface RegionsApiResponse {
  regions: RegionDashboardRow[];
  configured?: boolean;
  lastUpdated?: string;
}

export interface GlobalTopicsApiResponse {
  globalTopics: GlobalTopic[];
  total: number;
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
