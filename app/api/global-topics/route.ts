import { NextResponse } from "next/server";
import type { GlobalTopic } from "@global-pulse/shared";
import { TOPIC_ALIASES } from "@global-pulse/shared";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";
import { mapGlobalTopicRow, type GlobalTopicRow } from "../_shared/mappers";

type Scope = "community" | "news" | "mixed";

function parseScope(value: string | null): Scope {
  if (value === "news" || value === "mixed") {
    return value;
  }
  return "community";
}

function normalizeTopicIdentity(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
}

function buildAliasLookup(): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const [canonicalLabel, aliases] of Object.entries(TOPIC_ALIASES)) {
    const canonical = normalizeTopicIdentity(canonicalLabel);
    if (!canonical) {
      continue;
    }

    lookup.set(canonical, canonical);
    for (const alias of aliases) {
      const normalizedAlias = normalizeTopicIdentity(alias);
      if (!normalizedAlias) {
        continue;
      }
      lookup.set(normalizedAlias, canonical);
    }
  }

  return lookup;
}

const ALIAS_LOOKUP = buildAliasLookup();

function canonicalTopicIdentity(topic: GlobalTopic): string {
  const normalizedEn = normalizeTopicIdentity(topic.nameEn);
  const normalizedKo = normalizeTopicIdentity(topic.nameKo);

  if (normalizedEn && ALIAS_LOOKUP.has(normalizedEn)) {
    return ALIAS_LOOKUP.get(normalizedEn)!;
  }
  if (normalizedKo && ALIAS_LOOKUP.has(normalizedKo)) {
    return ALIAS_LOOKUP.get(normalizedKo)!;
  }

  return normalizedEn || normalizedKo;
}

function hasTopicIdOverlap(a: GlobalTopic, b: GlobalTopic): boolean {
  if (!a.topicIds.length || !b.topicIds.length) {
    return false;
  }
  const aIds = new Set(a.topicIds);
  return b.topicIds.some((topicId) => aIds.has(topicId));
}

function chooseTopicName(existing: string, incoming: string): string {
  if (!existing) return incoming;
  if (!incoming) return existing;
  return incoming.length > existing.length ? incoming : existing;
}

function chooseSummary(existing?: string, incoming?: string): string | undefined {
  if (!existing) return incoming;
  if (!incoming) return existing;
  return incoming.length > existing.length ? incoming : existing;
}

function toMs(value?: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function mergePropagationTimeline(
  existing: GlobalTopic["propagationTimeline"] | undefined,
  incoming: GlobalTopic["propagationTimeline"] | undefined,
): GlobalTopic["propagationTimeline"] {
  const merged = new Map<string, { firstPostAt: string; heatAtDiscovery: number; status?: "fading" | "steady" | "accelerating" }>();
  const entries = [...(existing ?? []), ...(incoming ?? [])];

  for (const item of entries) {
    if (!item || !item.regionId) {
      continue;
    }
    const current = merged.get(item.regionId);
    const itemMs = toMs(item.firstPostAt) ?? Number.POSITIVE_INFINITY;
    const currentMs = current ? toMs(current.firstPostAt) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;

    if (!current || itemMs < currentMs) {
      merged.set(item.regionId, {
        firstPostAt: item.firstPostAt,
        heatAtDiscovery: item.heatAtDiscovery,
        status: item.status,
      });
    }
  }

  return [...merged.entries()]
    .map(([regionId, payload]) => ({ regionId, ...payload }))
    .sort((left, right) => (toMs(left.firstPostAt) ?? 0) - (toMs(right.firstPostAt) ?? 0));
}

function mergePropagationEdges(
  existing: GlobalTopic["propagationEdges"] | undefined,
  incoming: GlobalTopic["propagationEdges"] | undefined,
): GlobalTopic["propagationEdges"] {
  const merged = new Map<string, { from: string; to: string; lagMinutes: number; confidence: number }>();
  for (const edge of [...(existing ?? []), ...(incoming ?? [])]) {
    if (!edge || !edge.from || !edge.to) {
      continue;
    }
    const key = `${edge.from}:${edge.to}:${edge.lagMinutes}`;
    const current = merged.get(key);
    if (!current || edge.confidence > current.confidence) {
      merged.set(key, edge);
    }
  }
  return [...merged.values()];
}

function mergeRegionalSentiment(
  leftSentiment: number | undefined,
  leftHeat: number,
  rightSentiment: number | undefined,
  rightHeat: number,
): number {
  const safeLeftHeat = Number.isFinite(leftHeat) ? Math.max(0, leftHeat) : 0;
  const safeRightHeat = Number.isFinite(rightHeat) ? Math.max(0, rightHeat) : 0;
  const leftWeight = Number.isFinite(leftSentiment ?? Number.NaN) ? safeLeftHeat || 1 : 0;
  const rightWeight = Number.isFinite(rightSentiment ?? Number.NaN) ? safeRightHeat || 1 : 0;
  const totalWeight = leftWeight + rightWeight;

  if (totalWeight === 0) {
    return 0;
  }

  const weighted =
    (Number(leftSentiment ?? 0) * leftWeight + Number(rightSentiment ?? 0) * rightWeight) / totalWeight;
  return Number(weighted.toFixed(3));
}

function mergeGlobalTopics(existing: GlobalTopic, incoming: GlobalTopic): GlobalTopic {
  const mergedRegionalHeatScores: Record<string, number> = {
    ...existing.regionalHeatScores,
  };
  const mergedRegionalSentiments: Record<string, number> = {
    ...existing.regionalSentiments,
  };

  const mergedRegions = new Set([...existing.regions, ...incoming.regions]);

  for (const regionId of incoming.regions) {
    const previousHeat = mergedRegionalHeatScores[regionId] ?? 0;
    const incomingHeat = incoming.regionalHeatScores[regionId] ?? 0;
    const nextHeat = Number((previousHeat + incomingHeat).toFixed(3));
    mergedRegionalHeatScores[regionId] = nextHeat;

    mergedRegionalSentiments[regionId] = mergeRegionalSentiment(
      mergedRegionalSentiments[regionId],
      previousHeat,
      incoming.regionalSentiments[regionId],
      incomingHeat,
    );
  }

  const existingFirstSeenMs = toMs(existing.firstSeenAt);
  const incomingFirstSeenMs = toMs(incoming.firstSeenAt);
  const useIncomingFirstSeen =
    incomingFirstSeenMs !== null &&
    (existingFirstSeenMs === null || incomingFirstSeenMs < existingFirstSeenMs);
  const propagationTimeline = mergePropagationTimeline(existing.propagationTimeline, incoming.propagationTimeline);
  const propagationEdges = mergePropagationEdges(existing.propagationEdges, incoming.propagationEdges);

  return {
    ...existing,
    nameEn: chooseTopicName(existing.nameEn, incoming.nameEn),
    nameKo: chooseTopicName(existing.nameKo, incoming.nameKo),
    summaryEn: chooseSummary(existing.summaryEn, incoming.summaryEn),
    summaryKo: chooseSummary(existing.summaryKo, incoming.summaryKo),
    regions: [...mergedRegions].sort(),
    regionalHeatScores: mergedRegionalHeatScores,
    regionalSentiments: mergedRegionalSentiments,
    topicIds: [...new Set([...existing.topicIds, ...incoming.topicIds])],
    totalHeatScore: Number((existing.totalHeatScore + incoming.totalHeatScore).toFixed(3)),
    firstSeenRegion: useIncomingFirstSeen ? incoming.firstSeenRegion : existing.firstSeenRegion,
    firstSeenAt: useIncomingFirstSeen ? incoming.firstSeenAt : existing.firstSeenAt,
    velocityPerHour: Number(
      Math.max(existing.velocityPerHour ?? Number.NEGATIVE_INFINITY, incoming.velocityPerHour ?? Number.NEGATIVE_INFINITY) ||
        0,
    ),
    acceleration: Number(
      Math.max(existing.acceleration ?? Number.NEGATIVE_INFINITY, incoming.acceleration ?? Number.NEGATIVE_INFINITY) ||
        0,
    ),
    spreadScore: Number(Math.max(existing.spreadScore ?? 0, incoming.spreadScore ?? 0)),
    propagationTimeline,
    propagationEdges,
  };
}

function dedupeAndMergeTopics(topics: GlobalTopic[], minRegions: number, sort: "heat" | "spread"): GlobalTopic[] {
  const merged: GlobalTopic[] = [];

  for (const topic of [...topics].sort((a, b) => b.totalHeatScore - a.totalHeatScore)) {
    const topicCanonical = canonicalTopicIdentity(topic);
    const existingIndex = merged.findIndex((candidate) => {
      const candidateCanonical = canonicalTopicIdentity(candidate);
      if (topicCanonical && candidateCanonical && topicCanonical === candidateCanonical) {
        return true;
      }
      return hasTopicIdOverlap(candidate, topic);
    });

    if (existingIndex === -1) {
      merged.push(topic);
      continue;
    }

    merged[existingIndex] = mergeGlobalTopics(merged[existingIndex]!, topic);
  }

  return merged
    .filter((topic) => topic.regions.length >= minRegions)
    .sort((a, b) => {
      if (sort === "spread") {
        return (b.spreadScore ?? 0) - (a.spreadScore ?? 0) || b.totalHeatScore - a.totalHeatScore;
      }
      return b.totalHeatScore - a.totalHeatScore;
    });
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/global-topics", () => getGlobalTopics(request));
}

async function getGlobalTopics(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);
  const minRegions = Math.max(Number(searchParams.get("minRegions") ?? 2), 1);
  const sort = searchParams.get("sort") === "spread" ? "spread" : "heat";
  const scope = parseScope(searchParams.get("scope"));
  const minAcceleration = Number(searchParams.get("min_acceleration") ?? Number.NaN);
  const statusFilter = searchParams.get("status");

  const postgres = getPostgresPoolOrNull();
  if (postgres) {
    try {
      const { rows: freshRows } = await postgres.query<GlobalTopicRow>(
        `
        select
          id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
          topic_ids,total_heat_score,first_seen_region,first_seen_at,velocity_per_hour,acceleration,spread_score,
          propagation_timeline,propagation_edges,scope,created_at
        from global_topics
        where (expires_at is null or expires_at > now())
          and scope = $1
        order by ${sort === "spread" ? "spread_score" : "total_heat_score"} desc nulls last, total_heat_score desc
        limit 100
        `,
        [scope],
      );

      let mapped = freshRows.map(mapGlobalTopicRow).filter((topic) => topic.regions.length >= minRegions);
      let dataState: "fresh" | "stale" | "empty" = mapped.length > 0 ? "fresh" : "empty";
      let supplementedFromHistory = false;

      if (mapped.length === 0) {
        const { rows: staleRows } = await postgres.query<GlobalTopicRow>(
          `
          select
            id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
            topic_ids,total_heat_score,first_seen_region,first_seen_at,velocity_per_hour,acceleration,spread_score,
            propagation_timeline,propagation_edges,scope,created_at
          from global_topics
          where scope = $1
          order by created_at desc, ${sort === "spread" ? "spread_score" : "total_heat_score"} desc nulls last
          limit 100
          `,
          [scope],
        );
        mapped = staleRows.map(mapGlobalTopicRow).filter((topic) => topic.regions.length >= minRegions);
        dataState = mapped.length > 0 ? "stale" : "empty";
      } else if (mapped.length < limit) {
        const { rows: staleRows } = await postgres.query<GlobalTopicRow>(
          `
          select
            id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
            topic_ids,total_heat_score,first_seen_region,first_seen_at,velocity_per_hour,acceleration,spread_score,
            propagation_timeline,propagation_edges,scope,created_at
          from global_topics
          where scope = $1
          order by created_at desc, ${sort === "spread" ? "spread_score" : "total_heat_score"} desc nulls last
          limit 200
          `,
          [scope],
        );

        for (const topic of staleRows.map(mapGlobalTopicRow)) {
          if (topic.regions.length < minRegions) {
            continue;
          }
          mapped.push(topic);
          supplementedFromHistory = true;
        }
      }

      mapped = dedupeAndMergeTopics(mapped, minRegions, sort)
        .filter((topic) => {
          if (Number.isFinite(minAcceleration) && (topic.acceleration ?? 0) < minAcceleration) {
            return false;
          }
          if (!statusFilter) {
            return true;
          }
          return (topic.propagationTimeline ?? []).some((item) => item.status === statusFilter);
        });

      return NextResponse.json({
        globalTopics: mapped.slice(0, limit),
        total: mapped.length,
        meta: {
          limit,
          minRegions,
          dataState,
          supplementedFromHistory,
          sort,
          scope,
          minAcceleration,
          status: statusFilter,
        },
        stale: dataState === "stale",
        configured: true,
        provider: "postgres",
        scope,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : String(error),
          globalTopics: [],
          total: 0,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    globalTopics: [],
    total: 0,
    meta: {
      limit,
      minRegions,
      sort,
      scope,
      minAcceleration,
      status: statusFilter,
    },
    configured: false,
    provider: "none",
    lastUpdated: new Date().toISOString(),
  });
}
