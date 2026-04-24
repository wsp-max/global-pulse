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
  sourceHealth?: RegionSourceHealthSummary;
  snapshotAt?: string | null;
  scope?: DashboardScope;
  dataState?: "fresh" | "stale" | "empty" | "partially-stale";
  supplementedFromHistory?: number;
  topTopics: Topic[];
}

export type SourceHealthStatus =
  | "healthy"
  | "stale"
  | "degraded"
  | "disabled"
  | "auto_disabled"
  | "optional_healthy"
  | "optional_stale"
  | "optional_degraded"
  | "optional_blocked";

export interface SourceHealthSummary {
  totalSources: number;
  activeSources: number;
  collectedSources24h: number;
  collectionCoveragePct: number;
  degradedActiveSources: number;
  disabledSources: number;
  autoDisabledSources: number;
  healthySources: number;
  staleSources: number;
  optionalSources: number;
  optionalHealthySources: number;
  optionalBlockedSources: number;
  recoveryNeededSources: number;
}

export interface RegionSourceHealthSummary {
  regionId: string;
  activeSources: number;
  collectedSources24h: number;
  coreActiveSources: number;
  coreCollectedSources24h: number;
  topicSources: number;
  collectionCoveragePct: number;
  topicCoveragePct: number;
  degradedActiveSources: number;
  disabledSources: number;
  autoDisabledSources: number;
  optionalSources: number;
  optionalCollectedSources24h: number;
  optionalHealthySources: number;
  optionalBlockedSources: number;
  missingCoreCommunitySources: boolean;
  optionalOnlyCommunity: boolean;
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

export interface SearchSemanticMeta {
  enabled: boolean;
  used: boolean;
  model: string | null;
  cacheHit: boolean;
  candidateCount: number;
}

export interface SearchApiResponse {
  query: string;
  region: string | null;
  topics: Topic[];
  globalTopics: GlobalTopic[];
  total: number;
  semantic?: SearchSemanticMeta;
  configured?: boolean;
  provider?: "postgres" | "none";
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

export type SourceTransferDirection = "community_to_news" | "news_to_community" | "both";

export interface SourceTransferSummary {
  totalEvents: number;
  uniquePairs: number;
  communityLeadCount: number;
  newsLeadCount: number;
  tieCount: number;
  forwardLeadCount: number;
  forwardLeadShare: number | null;
  medianLagMinutes: number | null;
  p90LagMinutes: number | null;
  latestDetectedAt: string | null;
}

export interface SourceTransferSankeyNode {
  id: string;
  label: string;
  scope: "community" | "news";
  topicId: number;
}

export interface SourceTransferSankeyLink {
  source: number;
  target: number;
  value: number;
  avgLagMinutes: number | null;
  pairKey: string;
  leader: "community" | "news" | "tie";
}

export interface SourceTransferTrendPoint {
  hour: string;
  eventCount: number;
  avgLagMinutes: number | null;
  communityLeadCount: number;
  newsLeadCount: number;
  tieCount: number;
}

export interface SourceTransferPairRow {
  pairKey: string;
  regionId: string;
  leader: "community" | "news" | "tie";
  communityTopicId: number;
  communityTopicNameKo: string;
  communityTopicNameEn: string;
  newsTopicId: number;
  newsTopicNameKo: string;
  newsTopicNameEn: string;
  eventCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  communityFirstPostAt: string | null;
  newsFirstPostAt: string | null;
  avgLagMinutes: number | null;
  latestLagMinutes: number | null;
  avgCosine: number | null;
  similarityScore?: number | null;
  similarityTier?: "high" | "medium" | "low";
  matchReasons?: string[];
}

export interface SourceTransferCandidatePairRow extends SourceTransferPairRow {
  confidence: "candidate";
  matchReasons: string[];
  matchScore: number;
}

export interface SourceTransferCandidateSummary {
  totalCandidates: number;
  returnedCandidates: number;
}

export interface SourceTransferApiResponse {
  summary: SourceTransferSummary;
  snapshotSummary: SourceTransferSummary;
  historySummary: SourceTransferSummary;
  latestAnalyzerRunAt: string | null;
  sankey: {
    nodes: SourceTransferSankeyNode[];
    links: SourceTransferSankeyLink[];
  };
  trendHourly: SourceTransferTrendPoint[];
  pairs: SourceTransferPairRow[];
  candidatePairs: SourceTransferCandidatePairRow[];
  candidateSummary: SourceTransferCandidateSummary;
  meta: {
    direction: SourceTransferDirection;
    hours: number;
    region: string;
    limit: number;
    offset: number;
    totalPairs: number;
    returnedPairs: number;
    rawTotalPairs?: number;
    hiddenLowSimilarityPairs?: number;
    hiddenStaleLagPairs?: number;
  };
  configured?: boolean;
  provider?: "postgres" | "none";
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
  meta?: {
    qualifiedCellCount: number;
    hiddenCellCount: number;
    lagCapHours: number;
  };
  configured?: boolean;
  provider?: "postgres" | "none";
  lastUpdated?: string;
}

export interface AdminTuningSetting {
  key: string;
  label: string;
  description: string;
  valueType: "number" | "string";
  envKey: string;
  value: unknown;
  effectiveValue: unknown;
  overriddenByEnv: boolean;
  updatedAt: string | null;
}

export interface AdminTuningAuditEntry {
  id: number;
  key: string;
  before: unknown;
  after: unknown;
  changedBy: string;
  changedAt: string;
}

export interface AdminTuningApiResponse {
  enabled: boolean;
  settings: AdminTuningSetting[];
  audit: AdminTuningAuditEntry[];
  lastUpdated?: string;
}
