import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";
import type { Pool } from "pg";

const logger = getLogger("cleanup");

type TableName = "raw_posts" | "topics" | "global_topics" | "heat_history" | "issue_overlap_events";

function log(message: string): void {
  logger.info(message);
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

async function countBeforePostgres(
  pool: Pool,
  table: TableName,
  column: string,
  isoValue: string,
): Promise<number> {
  const query = `select count(*) as total from ${table} where ${column} < $1`;
  const { rows } = await pool.query<{ total: string | number }>(query, [isoValue]);
  return toNumber(rows[0]?.total);
}

async function deleteBeforePostgres(
  pool: Pool,
  table: TableName,
  column: string,
  isoValue: string,
): Promise<void> {
  const query = `delete from ${table} where ${column} < $1`;
  await pool.query(query, [isoValue]);
}

async function deleteExpiredPostgres(
  pool: Pool,
  table: "topics" | "global_topics",
  nowIso: string,
): Promise<number> {
  const { rows } = await pool.query<{ total: string | number }>(
    `select count(*) as total from ${table} where expires_at <= $1`,
    [nowIso],
  );

  const count = toNumber(rows[0]?.total);
  if (count === 0) {
    return 0;
  }

  await pool.query(`delete from ${table} where expires_at <= $1`, [nowIso]);
  return count;
}

async function main(): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const rawPostsCutoffIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const heatHistoryCutoffIso = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const overlapEventsCutoffIso = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  if (!hasPostgresConfig()) {
    log("PostgreSQL configuration missing. Skipping cleanup.");
    return;
  }

  const pool = createPostgresPool();
  const rawPostsToDelete = await countBeforePostgres(pool, "raw_posts", "collected_at", rawPostsCutoffIso);
  await deleteBeforePostgres(pool, "raw_posts", "collected_at", rawPostsCutoffIso);

  const heatHistoryToDelete = await countBeforePostgres(
    pool,
    "heat_history",
    "recorded_at",
    heatHistoryCutoffIso,
  );
  await deleteBeforePostgres(pool, "heat_history", "recorded_at", heatHistoryCutoffIso);

  const overlapEventsToDelete = await countBeforePostgres(
    pool,
    "issue_overlap_events",
    "detected_at",
    overlapEventsCutoffIso,
  );
  await deleteBeforePostgres(pool, "issue_overlap_events", "detected_at", overlapEventsCutoffIso);

  const expiredTopics = await deleteExpiredPostgres(pool, "topics", nowIso);
  const expiredGlobalTopics = await deleteExpiredPostgres(pool, "global_topics", nowIso);

  log(
    `Cleanup complete. db=postgres raw_posts=${rawPostsToDelete}, heat_history=${heatHistoryToDelete}, issue_overlap_events=${overlapEventsToDelete}, topics=${expiredTopics}, global_topics=${expiredGlobalTopics}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
