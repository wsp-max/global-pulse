import type { Topic } from "@global-pulse/shared";
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

function toTopic(row: TopicRow): Topic {
  return {
    id: toNumber(row.id),
    regionId: row.region_id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    summaryKo: row.summary_ko ?? undefined,
    summaryEn: row.summary_en ?? undefined,
    keywords: row.keywords ?? [],
    sentiment: toNumber(row.sentiment),
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
        select
          id,region_id,name_ko,name_en,summary_ko,summary_en,keywords,sentiment,heat_score,post_count,
          total_views,total_likes,total_comments,source_ids,rank,period_start,period_end
        from topics
        where period_end >= $1
        order by period_end desc
        limit 3000
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
  const similarity = Number(parseArg("--similarity") ?? 0.32);

  const windowHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 168) : 24;
  const threshold = Number.isFinite(similarity)
    ? Math.max(0.05, Math.min(similarity, 0.95))
    : 0.32;

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

  const topics = (await storage.fetchTopics(periodStartIso)).map(toTopic);
  if (topics.length === 0) {
    log("No recent topics found. Expiring currently active global topics.");
    await storage.expireActiveGlobalTopics(nowIso);
    return;
  }

  const mapped = mapCrossRegionTopics(topics, {
    similarityThreshold: threshold,
    minRegions,
  }).slice(0, limit);

  await storage.expireActiveGlobalTopics(nowIso);

  if (mapped.length === 0) {
    log("No cross-region topics matched after mapping.");
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
