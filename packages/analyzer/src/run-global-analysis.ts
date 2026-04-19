import { SOURCES, type GlobalTopic, type Topic } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";
import type { Pool } from "pg";
import { mapCrossRegionTopics } from "./cross-region-mapper";

const logger = getLogger("global-analyzer");

interface TopicRow {
  id: number;
  region_id: string;
  name_ko: string;
  name_en: string;
  summary_ko: string | null;
  summary_en: string | null;
  keywords: string[] | null;
  sentiment: number | null;
  heat_score: number | null;
  post_count: number | null;
  total_views: number | null;
  total_likes: number | null;
  total_comments: number | null;
  source_ids: string[] | null;
  rank: number | null;
  period_start: string;
  period_end: string;
}

interface GlobalTopicInsertRow {
  name_en: string;
  name_ko: string;
  summary_en: string | null;
  summary_ko: string | null;
  regions: string[];
  regional_sentiments: Record<string, number>;
  regional_heat_scores: Record<string, number>;
  topic_ids: number[];
  total_heat_score: number;
  first_seen_region: string | null;
  first_seen_at: string | null;
  expires_at: string;
}

interface GlobalAnalysisStorage {
  mode: "postgres";
  fetchTopics(periodStartIso: string): Promise<TopicRow[]>;
  expireActiveGlobalTopics(nowIso: string): Promise<void>;
  insertGlobalTopics(rows: GlobalTopicInsertRow[]): Promise<void>;
}

function log(message: string): void {
  logger.info(message);
}

function parseArg(flag: string): string | undefined {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTopic(row: TopicRow): Topic {
  return {
    id: toNumber(row.id),
    regionId: row.region_id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    summaryKo: row.summary_ko ?? undefined,
    summaryEn: row.summary_en ?? undefined,
    keywords: row.keywords ?? [],
    sentiment: toNullableNumber(row.sentiment),
    heatScore: toNumber(row.heat_score),
    postCount: toNumber(row.post_count),
    totalViews: toNumber(row.total_views),
    totalLikes: toNumber(row.total_likes),
    totalComments: toNumber(row.total_comments),
    sourceIds: row.source_ids ?? [],
    rank: row.rank === null || row.rank === undefined ? undefined : toNumber(row.rank),
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
}

function allowedSourceIdsByRegion(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const source of SOURCES) {
    const set = map.get(source.regionId) ?? new Set<string>();
    set.add(source.id);
    map.set(source.regionId, set);
  }

  return map;
}

const allowedSourcesByRegion = allowedSourceIdsByRegion();

function hasRegionSourceOverlap(regionId: string, sourceIds: string[] | null): boolean {
  if (!sourceIds || sourceIds.length === 0) {
    return false;
  }

  const allowedSources = allowedSourcesByRegion.get(regionId);
  if (!allowedSources || allowedSources.size === 0) {
    return false;
  }

  return sourceIds.some((sourceId) => allowedSources.has(sourceId));
}

function sanitizeGlobalTopicByRegions(topic: GlobalTopic, topicMap: Map<number, Topic>): GlobalTopic | null {
  const filteredRegionEntries = new Map<string, number[]>();

  for (const topicId of topic.topicIds) {
    const regionTopic = topicMap.get(topicId);
    if (!regionTopic) {
      continue;
    }

    if (!hasRegionSourceOverlap(regionTopic.regionId, regionTopic.sourceIds)) {
      continue;
    }

    const current = filteredRegionEntries.get(regionTopic.regionId);
    if (current) {
      current.push(topicId);
    } else {
      filteredRegionEntries.set(regionTopic.regionId, [topicId]);
    }
  }

  const filteredRegions = topic.regions.filter((regionId) => filteredRegionEntries.has(regionId));
  if (filteredRegions.length < 2) {
    return null;
  }

  const regionalHeatScores: Record<string, number> = {};
  const regionalSentiments: Record<string, number> = {};
  const keptTopicIds = new Set<number>();
  const seededTopics: Topic[] = [];

  for (const regionId of filteredRegions) {
    const regionTopicIds = filteredRegionEntries.get(regionId) ?? [];
    for (const regionTopicId of regionTopicIds) {
      keptTopicIds.add(regionTopicId);
    }

    const regionTopics = regionTopicIds
      .map((id) => topicMap.get(id))
      .filter((item): item is Topic => Boolean(item));
    if (regionTopics.length === 0) {
      continue;
    }

    seededTopics.push(...regionTopics);
    const totalHeat = regionTopics.reduce((sum, item) => sum + item.heatScore, 0);
    const regionSentimentValues = regionTopics
      .map((item) => item.sentiment)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const totalSentiment =
      regionSentimentValues.length > 0
        ? regionSentimentValues.reduce((sum, value) => sum + value, 0) / regionSentimentValues.length
        : 0;

    regionalHeatScores[regionId] = Number(totalHeat.toFixed(3));
    regionalSentiments[regionId] = Number(totalSentiment.toFixed(3));
  }

  if (seededTopics.length === 0) {
    return null;
  }

  const firstSeen = [...seededTopics].sort(
    (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
  )[0];

  const totalHeatScore = filteredRegions.reduce((sum, regionId) => sum + (regionalHeatScores[regionId] ?? 0), 0);

  return {
    ...topic,
    regions: filteredRegions,
    regionalHeatScores,
    regionalSentiments,
    topicIds: [...keptTopicIds],
    totalHeatScore: Number(totalHeatScore.toFixed(3)),
    firstSeenRegion: firstSeen.regionId,
    firstSeenAt: firstSeen.periodStart,
  };
}

function buildBatchInsert<T extends object>(
  tableName: string,
  columns: Array<keyof T & string>,
  rows: T[],
): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const tuples: string[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const placeholders: string[] = [];
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const valueIndex = rowIndex * columns.length + columnIndex + 1;
      placeholders.push(`$${valueIndex}`);
      const value = row[columns[columnIndex]];
      values.push(value === undefined ? null : value);
    }
    tuples.push(`(${placeholders.join(",")})`);
  }

  return {
    sql: `insert into ${tableName} (${columns.join(",")}) values ${tuples.join(",")}`,
    values,
  };
}

function createPostgresStorage(pool: Pool): GlobalAnalysisStorage {
  return {
    mode: "postgres",
    async fetchTopics(periodStartIso) {
      const { rows } = await pool.query<TopicRow>(
        `
        with distinct_region_batches as (
          select distinct region_id, created_at
          from topics
          where period_end >= $1
        ),
        latest_region_batches as (
          select
            region_id,
            created_at,
            row_number() over (partition by region_id order by created_at desc) as rn
          from distinct_region_batches
        ),
        selected_region_batches as (
          select region_id, created_at
          from latest_region_batches
          where rn <= 3
        )
        select
          t.id,t.region_id,t.name_ko,t.name_en,t.summary_ko,t.summary_en,t.keywords,t.sentiment,t.heat_score,t.post_count,
          t.total_views,t.total_likes,t.total_comments,t.source_ids,t.rank,t.period_start,t.period_end
        from topics t
        join selected_region_batches b
          on t.region_id = b.region_id
         and t.created_at = b.created_at
        order by t.heat_score desc nulls last
        limit 4500
        `,
        [periodStartIso],
      );
      return rows;
    },
    async expireActiveGlobalTopics(nowIso) {
      await pool.query(
        `
        update global_topics
        set expires_at = $1
        where expires_at is null or expires_at > $1
        `,
        [nowIso],
      );
    },
    async insertGlobalTopics(rows) {
      if (rows.length === 0) return;
      const columns: Array<keyof GlobalTopicInsertRow & string> = [
        "name_en",
        "name_ko",
        "summary_en",
        "summary_ko",
        "regions",
        "regional_sentiments",
        "regional_heat_scores",
        "topic_ids",
        "total_heat_score",
        "first_seen_region",
        "first_seen_at",
        "expires_at",
      ];
      const batch = buildBatchInsert("global_topics", columns, rows);
      await pool.query(batch.sql, batch.values);
    },
  };
}

function resolveStorage(): GlobalAnalysisStorage | null {
  if (!hasPostgresConfig()) {
    log("PostgreSQL configuration missing. Skipping global analysis run.");
    return null;
  }

  const pool = createPostgresPool();
  return createPostgresStorage(pool);
}

async function runGlobalAnalysis(): Promise<void> {
  const hours = Number(parseArg("--hours") ?? 24);
  const limit = Math.min(Number(parseArg("--limit") ?? 25), 100);
  const minRegions = Math.max(Number(parseArg("--min-regions") ?? 2), 2);
  const similarity = Number(parseArg("--similarity") ?? 0.24);

  const windowHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 168) : 24;
  const threshold = Number.isFinite(similarity)
    ? Math.max(0.05, Math.min(similarity, 0.95))
    : 0.24;

  const storage = resolveStorage();
  if (!storage) {
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const periodStartIso = new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString();
  const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();

  log(
    `Starting global analysis. db=${storage.mode} window=${windowHours}h minRegions=${minRegions} similarity=${threshold}`,
  );

  await storage.expireActiveGlobalTopics(nowIso);

  const fetchedTopics = (await storage.fetchTopics(periodStartIso))
    .map(toTopic)
    .filter((topic) => hasRegionSourceOverlap(topic.regionId, topic.sourceIds));
  if (fetchedTopics.length === 0) {
    log("No recent topics found. Global topic table has been expired for this run.");
    return;
  }

  const topicById = new Map<number, Topic>(fetchedTopics.map((topic) => [topic.id ?? 0, topic]));
  const mapped = mapCrossRegionTopics(fetchedTopics, {
    similarityThreshold: threshold,
    minRegions,
  })
    .map((topic) => sanitizeGlobalTopicByRegions(topic, topicById))
    .filter((topic): topic is GlobalTopic => Boolean(topic))
    .slice(0, limit);

  if (mapped.length === 0) {
    log("No cross-region topics matched after mapping. Keeping currently active global topics.");
    return;
  }

  const payload: GlobalTopicInsertRow[] = mapped.map((topic) => ({
    name_en: topic.nameEn,
    name_ko: topic.nameKo,
    summary_en: topic.summaryEn ?? null,
    summary_ko: topic.summaryKo ?? null,
    regions: topic.regions,
    regional_sentiments: topic.regionalSentiments,
    regional_heat_scores: topic.regionalHeatScores,
    topic_ids: topic.topicIds,
    total_heat_score: topic.totalHeatScore,
    first_seen_region: topic.firstSeenRegion ?? null,
    first_seen_at: topic.firstSeenAt ?? null,
    expires_at: expiresAt,
  }));

  await storage.insertGlobalTopics(payload);

  log(`Global analysis completed. generated=${mapped.length}`);
}

runGlobalAnalysis().catch((error) => {
  logger.error(`Global analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
