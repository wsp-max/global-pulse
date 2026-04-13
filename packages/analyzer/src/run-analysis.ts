import { SOURCES } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";
import type { Pool } from "pg";
import { extractKeywords, type AnalysisPostInput } from "./keyword-extractor";
import { summarizeTopicsWithGemini } from "./gemini-summarizer";
import { clusterTopics } from "./topic-clusterer";

const logger = getLogger("analyzer");

function log(message: string): void {
  logger.info(message);
}

interface RawPostRow {
  id: number;
  source_id: string;
  title: string;
  body_preview: string | null;
  view_count: number | string | null;
  like_count: number | string | null;
  dislike_count: number | string | null;
  comment_count: number | string | null;
  posted_at: string | null;
  collected_at: string | null;
}

interface TopicInsertRow {
  region_id: string;
  name_ko: string;
  name_en: string;
  summary_ko: string | null;
  summary_en: string | null;
  keywords: string[];
  sentiment: number;
  heat_score: number;
  post_count: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  source_ids: string[];
  rank: number | null;
  period_start: string;
  period_end: string;
  expires_at: string;
}

interface HeatHistoryInsertRow {
  region_id: string;
  topic_name: string;
  heat_score: number;
  sentiment: number;
  post_count: number;
  recorded_at: string;
}

interface SnapshotInsertRow {
  region_id: string;
  total_heat_score: number;
  active_topics: number;
  avg_sentiment: number;
  top_keywords: string[];
  sources_active: number;
  sources_total: number;
  snapshot_at: string;
}

interface AnalysisStorage {
  mode: "postgres";
  fetchRawPosts(sourceIds: string[], periodStartIso: string): Promise<RawPostRow[]>;
  insertTopics(rows: TopicInsertRow[]): Promise<void>;
  insertHeatHistory(rows: HeatHistoryInsertRow[]): Promise<void>;
  insertRegionSnapshot(row: SnapshotInsertRow): Promise<void>;
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

function toAnalysisPost(row: RawPostRow): AnalysisPostInput {
  return {
    id: String(row.id),
    sourceId: row.source_id,
    title: row.title,
    bodyPreview: row.body_preview,
    viewCount: toNumber(row.view_count),
    likeCount: toNumber(row.like_count),
    dislikeCount: toNumber(row.dislike_count),
    commentCount: toNumber(row.comment_count),
    postedAt: row.posted_at,
    collectedAt: row.collected_at,
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

function createPostgresStorage(pool: Pool): AnalysisStorage {
  return {
    mode: "postgres",
    async fetchRawPosts(sourceIds, periodStartIso) {
      const { rows } = await pool.query<RawPostRow>(
        `
        select
          id,source_id,title,body_preview,view_count,like_count,dislike_count,comment_count,posted_at,collected_at
        from raw_posts
        where source_id = any($1::text[])
          and collected_at >= $2
        order by collected_at desc
        limit 1000
        `,
        [sourceIds, periodStartIso],
      );
      return rows;
    },
    async insertTopics(rows) {
      if (rows.length === 0) return;
      const columns: Array<keyof TopicInsertRow & string> = [
        "region_id",
        "name_ko",
        "name_en",
        "summary_ko",
        "summary_en",
        "keywords",
        "sentiment",
        "heat_score",
        "post_count",
        "total_views",
        "total_likes",
        "total_comments",
        "source_ids",
        "rank",
        "period_start",
        "period_end",
        "expires_at",
      ];
      const batch = buildBatchInsert("topics", columns, rows);
      await pool.query(batch.sql, batch.values);
    },
    async insertHeatHistory(rows) {
      if (rows.length === 0) return;
      const columns: Array<keyof HeatHistoryInsertRow & string> = [
        "region_id",
        "topic_name",
        "heat_score",
        "sentiment",
        "post_count",
        "recorded_at",
      ];
      const batch = buildBatchInsert("heat_history", columns, rows);
      await pool.query(batch.sql, batch.values);
    },
    async insertRegionSnapshot(row) {
      await pool.query(
        `
        insert into region_snapshots (
          region_id,total_heat_score,active_topics,avg_sentiment,top_keywords,sources_active,sources_total,snapshot_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          row.region_id,
          row.total_heat_score,
          row.active_topics,
          row.avg_sentiment,
          row.top_keywords,
          row.sources_active,
          row.sources_total,
          row.snapshot_at,
        ],
      );
    },
  };
}

function resolveStorage(): AnalysisStorage | null {
  if (!hasPostgresConfig()) {
    log("PostgreSQL configuration missing. Skipping analysis run.");
    return null;
  }

  const pool = createPostgresPool();
  return createPostgresStorage(pool);
}

function sourceIdsForRegion(regionId: string): string[] {
  return SOURCES.filter((source) => source.regionId === regionId).map((source) => source.id);
}

function targetRegionIds(regionFilter?: string): string[] {
  if (regionFilter) {
    return [regionFilter];
  }
  return [...new Set(SOURCES.map((source) => source.regionId))];
}

async function runRegionAnalysis(params: {
  storage: AnalysisStorage;
  regionId: string;
  periodStartIso: string;
  periodEndIso: string;
  useGemini: boolean;
}): Promise<void> {
  const { storage, regionId, periodStartIso, periodEndIso, useGemini } = params;
  const sourceIds = sourceIdsForRegion(regionId);

  if (sourceIds.length === 0) {
    log(`[${regionId}] skipped: no source definitions.`);
    return;
  }

  const rows = await storage.fetchRawPosts(sourceIds, periodStartIso);
  const posts = rows.map(toAnalysisPost);
  if (posts.length === 0) {
    log(`[${regionId}] no posts collected in the period.`);
    return;
  }

  const keywords = await extractKeywords(regionId, posts);
  const topics = await clusterTopics(regionId, keywords, posts, {
    periodStart: periodStartIso,
    periodEnd: periodEndIso,
  });

  if (topics.length === 0) {
    log(`[${regionId}] no topics generated.`);
    return;
  }

  const analyzedTopics = useGemini
    ? await summarizeTopicsWithGemini(topics, { regionId }).catch((error) => {
        log(
          `[${regionId}] gemini summarization failed, falling back to local topics: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return topics;
      })
    : topics;

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const topicRows: TopicInsertRow[] = analyzedTopics.map((topic) => ({
    region_id: topic.regionId,
    name_ko: topic.nameKo,
    name_en: topic.nameEn,
    summary_ko: topic.summaryKo ?? null,
    summary_en: topic.summaryEn ?? null,
    keywords: topic.keywords,
    sentiment: topic.sentiment,
    heat_score: topic.heatScore,
    post_count: topic.postCount,
    total_views: topic.totalViews,
    total_likes: topic.totalLikes,
    total_comments: topic.totalComments,
    source_ids: topic.sourceIds,
    rank: topic.rank ?? null,
    period_start: topic.periodStart,
    period_end: topic.periodEnd,
    expires_at: expiresAt,
  }));

  await storage.insertTopics(topicRows);

  const historyRows: HeatHistoryInsertRow[] = analyzedTopics.map((topic) => ({
    region_id: topic.regionId,
    topic_name: topic.nameEn,
    heat_score: topic.heatScore,
    sentiment: topic.sentiment,
    post_count: topic.postCount,
    recorded_at: periodEndIso,
  }));

  await storage.insertHeatHistory(historyRows);

  const totalHeatScore = analyzedTopics.reduce((sum, topic) => sum + topic.heatScore, 0);
  const avgSentiment =
    analyzedTopics.reduce((sum, topic) => sum + topic.sentiment, 0) /
    Math.max(analyzedTopics.length, 1);

  await storage.insertRegionSnapshot({
    region_id: regionId,
    total_heat_score: totalHeatScore,
    active_topics: analyzedTopics.length,
    avg_sentiment: Number(avgSentiment.toFixed(4)),
    top_keywords: keywords.slice(0, 10).map((keyword) => keyword.keyword),
    sources_active: new Set(posts.map((post) => post.sourceId)).size,
    sources_total: sourceIds.length,
    snapshot_at: periodEndIso,
  });

  log(
    `[${regionId}] posts=${posts.length}, keywords=${keywords.length}, topics=${analyzedTopics.length}, totalHeat=${totalHeatScore.toFixed(
      1,
    )}`,
  );
}

async function runAnalysis(): Promise<void> {
  const regionFilter = parseArg("--region");
  const hours = Number(parseArg("--hours") ?? 6);
  const useGemini = process.argv.includes("--with-gemini");
  const analysisHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 168) : 6;

  const storage = resolveStorage();
  if (!storage) {
    return;
  }

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - analysisHours * 60 * 60 * 1000);
  const periodStartIso = periodStart.toISOString();
  const periodEndIso = periodEnd.toISOString();
  const regions = targetRegionIds(regionFilter);

  log(
    `Starting analysis pipeline. db=${storage.mode} regions=${regions.join(",")} window=${analysisHours}h start=${periodStartIso} gemini=${useGemini}`,
  );

  for (const regionId of regions) {
    await runRegionAnalysis({
      storage,
      regionId,
      periodStartIso,
      periodEndIso,
      useGemini,
    });
  }

  log("Analysis complete.");
}

runAnalysis().catch((error) => {
  logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

