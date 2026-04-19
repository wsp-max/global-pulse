import { NextResponse } from "next/server";
import type { GlobalTopic } from "@global-pulse/shared";
import { TOPIC_ALIASES } from "@global-pulse/shared";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";
import { mapGlobalTopicRow, type GlobalTopicRow } from "../_shared/mappers";

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
  };
}

function dedupeAndMergeTopics(topics: GlobalTopic[], minRegions: number): GlobalTopic[] {
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
    .sort((a, b) => b.totalHeatScore - a.totalHeatScore);
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/global-topics", () => getGlobalTopics(request));
}

async function getGlobalTopics(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);
  const minRegions = Math.max(Number(searchParams.get("minRegions") ?? 2), 1);

  const postgres = getPostgresPoolOrNull();
  if (postgres) {
    try {
      const { rows: freshRows } = await postgres.query<GlobalTopicRow>(
        `
        select
          id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
          topic_ids,total_heat_score,first_seen_region,first_seen_at,created_at
        from global_topics
        where expires_at is null or expires_at > now()
        order by total_heat_score desc
        limit 100
        `,
      );

      let mapped = freshRows.map(mapGlobalTopicRow).filter((topic) => topic.regions.length >= minRegions);
      let dataState: "fresh" | "stale" | "empty" = mapped.length > 0 ? "fresh" : "empty";
      let supplementedFromHistory = false;

      if (mapped.length === 0) {
        const { rows: staleRows } = await postgres.query<GlobalTopicRow>(
          `
          select
            id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
            topic_ids,total_heat_score,first_seen_region,first_seen_at,created_at
          from global_topics
          order by created_at desc, total_heat_score desc
          limit 100
          `,
        );
        mapped = staleRows.map(mapGlobalTopicRow).filter((topic) => topic.regions.length >= minRegions);
        dataState = mapped.length > 0 ? "stale" : "empty";
      } else if (mapped.length < limit) {
        const { rows: staleRows } = await postgres.query<GlobalTopicRow>(
          `
          select
            id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
            topic_ids,total_heat_score,first_seen_region,first_seen_at,created_at
          from global_topics
          order by created_at desc, total_heat_score desc
          limit 200
          `,
        );

        for (const topic of staleRows.map(mapGlobalTopicRow)) {
          if (topic.regions.length < minRegions) {
            continue;
          }
          mapped.push(topic);
          supplementedFromHistory = true;
        }
      }

      mapped = dedupeAndMergeTopics(mapped, minRegions);

      return NextResponse.json({
        globalTopics: mapped.slice(0, limit),
        total: mapped.length,
        meta: { limit, minRegions, dataState, supplementedFromHistory },
        stale: dataState === "stale",
        configured: true,
        provider: "postgres",
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
    },
    configured: false,
    provider: "none",
    lastUpdated: new Date().toISOString(),
  });
}
