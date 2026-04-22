import type { GlobalTopic, Topic } from "@global-pulse/shared";
import { isLowInfoTopicName, normalizeTopicNameValue } from "@global-pulse/shared";
import type { DashboardScope, RegionDashboardRow } from "@/lib/types/api";
import { cleanupTopicName } from "@/lib/utils/topic-name";

export type SignalScope = Exclude<DashboardScope, "mixed"> | "mixed";

interface SignalThreshold {
  minConfidence: number;
  maxLagMinutes: number;
  minRegions: number;
  minSpreadScore: number;
  minHeatScore: number;
}

export interface SourceComparisonBadge {
  label: string;
  tone: "match" | "lead" | "confirm" | "solo" | "muted";
}

export interface RegionComparisonSummary {
  badge: SourceComparisonBadge;
  overlapCount: number;
  secondaryHeat: number;
  secondaryActiveTopics: number;
}

const URL_LIKE_REGEX = /(https?:\/\/|www\.|\/r\/|submitted by|please read)/i;
const NON_WORD_IDENTITY_REGEX = /[\p{P}\p{S}\s]+/gu;
const TOPIC_PLACEHOLDER_REGEX = /^globaltopic\d+$/i;

const SIGNAL_THRESHOLDS: Record<SignalScope, SignalThreshold> = {
  community: {
    minConfidence: 0.35,
    maxLagMinutes: 24 * 60,
    minRegions: 3,
    minSpreadScore: 3,
    minHeatScore: 1500,
  },
  news: {
    minConfidence: 0.25,
    maxLagMinutes: 72 * 60,
    minRegions: 2,
    minSpreadScore: 2,
    minHeatScore: 3000,
  },
  mixed: {
    minConfidence: 0.25,
    maxLagMinutes: 72 * 60,
    minRegions: 2,
    minSpreadScore: 2,
    minHeatScore: 3000,
  },
};

function normalizeIdentity(value: string | null | undefined): string | null {
  const normalized = normalizeTopicNameValue(value);
  if (!normalized) {
    return null;
  }

  if (URL_LIKE_REGEX.test(normalized)) {
    return null;
  }

  const collapsed = normalized.toLowerCase().replace(NON_WORD_IDENTITY_REGEX, "");
  if (!collapsed || collapsed.length < 5 || TOPIC_PLACEHOLDER_REGEX.test(collapsed)) {
    return null;
  }

  return collapsed;
}

function isLowSignalCandidate(value: string | null | undefined): boolean {
  const normalized = normalizeTopicNameValue(value);
  if (!normalized) {
    return true;
  }

  if (URL_LIKE_REGEX.test(normalized)) {
    return true;
  }

  return isLowInfoTopicName(normalized, "ko") && isLowInfoTopicName(normalized, "en");
}

function buildIdentityFromCandidates(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (isLowSignalCandidate(candidate)) {
      continue;
    }

    const identity = normalizeIdentity(candidate);
    if (identity) {
      return identity;
    }
  }

  return null;
}

function toFinite(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function oppositeScope(scope: SignalScope): Exclude<SignalScope, "mixed"> {
  return scope === "news" ? "community" : "news";
}

export function getScopeShortLabel(scope: SignalScope): string {
  return scope === "news" ? "뉴스" : "커뮤";
}

export function getScopeLongLabel(scope: SignalScope): string {
  return scope === "news" ? "뉴스" : "커뮤니티";
}

export function getSignalThreshold(scope: SignalScope): SignalThreshold {
  return SIGNAL_THRESHOLDS[scope];
}

export function getRegionalTopicIdentity(
  topic: Pick<
    Topic,
    | "canonicalKey"
    | "nameKo"
    | "nameEn"
    | "summaryKo"
    | "summaryEn"
    | "sampleTitles"
    | "keywords"
    | "entities"
    | "id"
    | "regionId"
  >,
): string | null {
  const canonicalIdentity = normalizeIdentity(topic.canonicalKey);
  if (canonicalIdentity) {
    return canonicalIdentity;
  }

  const cleaned = cleanupTopicName({
    id: topic.id,
    regionId: topic.regionId,
    nameKo: topic.nameKo,
    nameEn: topic.nameEn,
    summaryKo: topic.summaryKo,
    summaryEn: topic.summaryEn,
    sampleTitles: topic.sampleTitles,
    keywords: topic.keywords,
    entities: topic.entities,
  });

  return buildIdentityFromCandidates([
    cleaned.displayKo,
    cleaned.displayEn,
    topic.summaryKo,
    topic.summaryEn,
    ...(topic.sampleTitles ?? []),
  ]);
}

export function getGlobalTopicIdentity(
  topic: Pick<GlobalTopic, "nameKo" | "nameEn" | "summaryKo" | "summaryEn" | "id">,
): string | null {
  const cleaned = cleanupTopicName({
    id: topic.id,
    nameKo: topic.nameKo,
    nameEn: topic.nameEn,
    summaryKo: topic.summaryKo,
    summaryEn: topic.summaryEn,
  });

  return buildIdentityFromCandidates([
    cleaned.displayKo,
    cleaned.displayEn,
    topic.summaryKo,
    topic.summaryEn,
  ]);
}

export function qualifyPropagationEdge(
  topic: GlobalTopic,
  edge: NonNullable<GlobalTopic["propagationEdges"]>[number],
  scope: SignalScope,
): boolean {
  if (!edge?.from || !edge?.to || edge.from === edge.to) {
    return false;
  }

  const threshold = getSignalThreshold(scope);
  if (toFinite(topic.totalHeatScore) < threshold.minHeatScore) {
    return false;
  }
  if (toFinite(topic.spreadScore) < threshold.minSpreadScore) {
    return false;
  }
  if (toFinite(edge.confidence) < threshold.minConfidence) {
    return false;
  }
  if (toFinite(edge.lagMinutes) <= 0 || toFinite(edge.lagMinutes) > threshold.maxLagMinutes) {
    return false;
  }

  return true;
}

export function qualifyGlobalTopic(topic: GlobalTopic, scope: SignalScope): boolean {
  const threshold = getSignalThreshold(scope);

  if (!getGlobalTopicIdentity(topic)) {
    return false;
  }
  if ((topic.regions ?? []).length < threshold.minRegions) {
    return false;
  }
  if (toFinite(topic.totalHeatScore) < threshold.minHeatScore) {
    return false;
  }
  if (toFinite(topic.spreadScore) < threshold.minSpreadScore) {
    return false;
  }

  const qualifiedEdges = (topic.propagationEdges ?? []).filter((edge) => qualifyPropagationEdge(topic, edge, scope));
  return qualifiedEdges.length > 0;
}

export function prepareQualifiedGlobalTopics(topics: GlobalTopic[], scope: SignalScope): GlobalTopic[] {
  const prepared: Array<GlobalTopic | null> = topics.map((topic) => {
      if (!qualifyGlobalTopic(topic, scope)) {
        return null;
      }

      const qualifiedEdges = (topic.propagationEdges ?? []).filter((edge) => qualifyPropagationEdge(topic, edge, scope));
      const activeRegions = new Set(qualifiedEdges.flatMap((edge) => [edge.from, edge.to]));
      const filteredTimeline = (topic.propagationTimeline ?? []).filter((point) => activeRegions.has(point.regionId));
      const filteredRegions = (topic.regions ?? []).filter((regionId) => activeRegions.has(regionId));
      const firstTimeline = filteredTimeline[0];

      return {
        ...topic,
        regions: filteredRegions.length > 0 ? filteredRegions : topic.regions,
        propagationEdges: qualifiedEdges,
        propagationTimeline: filteredTimeline.length > 0 ? filteredTimeline : topic.propagationTimeline,
        firstSeenRegion: firstTimeline?.regionId ?? topic.firstSeenRegion,
        firstSeenAt: firstTimeline?.firstPostAt ?? topic.firstSeenAt,
      };
    });

  return prepared.filter((topic): topic is GlobalTopic => topic !== null);
}

export function countQualifiedRoutes(topics: GlobalTopic[], scope: SignalScope): number {
  return prepareQualifiedGlobalTopics(topics, scope).reduce(
    (sum, topic) => sum + (topic.propagationEdges?.length ?? 0),
    0,
  );
}

export function buildGlobalTopicLookup(topics: GlobalTopic[]): Map<string, GlobalTopic> {
  const lookup = new Map<string, GlobalTopic>();

  for (const topic of topics) {
    const identity = getGlobalTopicIdentity(topic);
    if (!identity) {
      continue;
    }

    const existing = lookup.get(identity);
    if (!existing || toFinite(topic.totalHeatScore) > toFinite(existing.totalHeatScore)) {
      lookup.set(identity, topic);
    }
  }

  return lookup;
}

export function buildGlobalTopicComparisonBadge(
  primaryTopic: GlobalTopic,
  secondaryLookup: Map<string, GlobalTopic>,
  primaryScope: SignalScope,
): SourceComparisonBadge {
  const secondaryScope = oppositeScope(primaryScope);
  const identity = getGlobalTopicIdentity(primaryTopic);
  const matched = identity ? secondaryLookup.get(identity) : null;

  if (!matched) {
    return {
      label: `${getScopeShortLabel(secondaryScope)} 미포착`,
      tone: "muted",
    };
  }

  const primaryHeat = Math.max(1, toFinite(primaryTopic.totalHeatScore));
  const secondaryHeat = Math.max(1, toFinite(matched.totalHeatScore));
  const ratio = primaryHeat / secondaryHeat;

  if (ratio >= 0.7 && ratio <= 1.4) {
    return { label: "양쪽 공통", tone: "match" };
  }

  if (primaryHeat > secondaryHeat) {
    return { label: `${getScopeShortLabel(primaryScope)} 선행`, tone: "lead" };
  }

  return { label: `${getScopeShortLabel(secondaryScope)} 확인`, tone: "confirm" };
}

export function buildRegionComparisonSummary(
  primaryRegion: RegionDashboardRow,
  secondaryRegion: RegionDashboardRow | null | undefined,
  primaryScope: SignalScope,
): RegionComparisonSummary {
  const secondaryScope = oppositeScope(primaryScope);
  const secondaryHeat = toFinite(secondaryRegion?.totalHeatScore);
  const secondaryActiveTopics = Math.max(0, Number(secondaryRegion?.activeTopics ?? 0));
  const secondaryExists = secondaryHeat > 0 || secondaryActiveTopics > 0;

  if (!secondaryExists) {
    return {
      badge: {
        label: `${getScopeShortLabel(secondaryScope)} 부재`,
        tone: "muted",
      },
      overlapCount: 0,
      secondaryHeat,
      secondaryActiveTopics,
    };
  }

  const primaryTopicKeys = new Set(
    primaryRegion.topTopics
      .map((topic) => getRegionalTopicIdentity(topic))
      .filter((value): value is string => Boolean(value)),
  );
  const secondaryTopicKeys = new Set(
    (secondaryRegion?.topTopics ?? [])
      .map((topic) => getRegionalTopicIdentity(topic))
      .filter((value): value is string => Boolean(value)),
  );

  let overlapCount = 0;
  for (const key of primaryTopicKeys) {
    if (secondaryTopicKeys.has(key)) {
      overlapCount += 1;
    }
  }

  const primaryHeat = Math.max(1, toFinite(primaryRegion.totalHeatScore));
  const ratio = primaryHeat / Math.max(secondaryHeat, 1);

  if (overlapCount > 0) {
    if (ratio >= 0.7 && ratio <= 1.4) {
      return {
        badge: { label: "양쪽 공통", tone: "match" },
        overlapCount,
        secondaryHeat,
        secondaryActiveTopics,
      };
    }

    if (primaryHeat > secondaryHeat) {
      return {
        badge: { label: `${getScopeShortLabel(primaryScope)} 선행`, tone: "lead" },
        overlapCount,
        secondaryHeat,
        secondaryActiveTopics,
      };
    }

    return {
      badge: { label: `${getScopeShortLabel(secondaryScope)}도 뜸`, tone: "confirm" },
      overlapCount,
      secondaryHeat,
      secondaryActiveTopics,
    };
  }

  if (secondaryHeat >= primaryHeat * 0.85) {
    return {
      badge: { label: `${getScopeShortLabel(secondaryScope)} 강함`, tone: "confirm" },
      overlapCount,
      secondaryHeat,
      secondaryActiveTopics,
    };
  }

  return {
    badge: { label: "해당 source만 강함", tone: "solo" },
    overlapCount,
    secondaryHeat,
    secondaryActiveTopics,
  };
}
