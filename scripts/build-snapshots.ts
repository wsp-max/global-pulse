import { DISABLED_SOURCE_ID_SET, SOURCES } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";
import type { Pool } from "pg";

const logger = getLogger("snapshot");

interface TopicSnapshotRow {
  region_id: string;
  heat_score: number | string | null;
  sentiment: number | string | null;
  keywords: string[] | null;
  source_ids: string[] | null;
}

interface RegionAccumulator {
  totalHeatScore: number;
  activeTopics: number;
  sentimentSum: number;
  sentimentCount: number;
  keywordCounts: Map<string, number>;
  sourceIds: Set<string>;
}

function buildAllowedSourceIdsByRegion(): Map<string, Set<string>> {
  const sourceIds = new Map<string, Set<string>>();
  for (const source of SOURCES.filter((item) => !DISABLED_SOURCE_ID_SET.has(item.id))) {
    const set = sourceIds.get(source.regionId) ?? new Set<string>();
    set.add(source.id);
    sourceIds.set(source.regionId, set);
  }
  return sourceIds;
}

function hasAllowedSource(regionId: string, sourceIds: string[] | null, allowedMap: Map<string, Set<string>>): boolean {
  if (!sourceIds || sourceIds.length === 0) {
    return false;
  }

  const allowed = allowedMap.get(regionId);
  if (!allowed || allowed.size === 0) {
    return false;
  }

  for (const sourceId of sourceIds) {
    if (allowed.has(sourceId)) {
      return true;
    }
  }

  return false;
}

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

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

function topKeywords(map: Map<string, number>, limit: number): string[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

function aggregateRows(
  rows: TopicSnapshotRow[],
  nowIso: string,
): Array<{
  region_id: string;
  total_heat_score: number;
  active_topics: number;
  avg_sentiment: number;
  top_keywords: string[];
  sources_active: number;
  sources_total: number;
  snapshot_at: string;
}> {
  const byRegion = new Map<string, RegionAccumulator>();

  for (const row of rows) {
    const key = row.region_id;
    const existing = byRegion.get(key) ?? {
      totalHeatScore: 0,
      activeTopics: 0,
      sentimentSum: 0,
      sentimentCount: 0,
      keywordCounts: new Map<string, number>(),
      sourceIds: new Set<string>(),
    };

    existing.totalHeatScore += toNumber(row.heat_score);
    existing.activeTopics += 1;
    existing.sentimentSum += toNumber(row.sentiment);
    existing.sentimentCount += 1;

    for (const keyword of row.keywords ?? []) {
      existing.keywordCounts.set(keyword, (existing.keywordCounts.get(keyword) ?? 0) + 1);
    }
    for (const sourceId of row.source_ids ?? []) {
      existing.sourceIds.add(sourceId);
    }

    byRegion.set(key, existing);
  }

  return [...byRegion.entries()].map(([regionId, acc]) => {
    const sourcesTotal = SOURCES.filter(
      (source) => source.regionId === regionId && !DISABLED_SOURCE_ID_SET.has(source.id),
    ).length;
    const avgSentiment = acc.sentimentCount === 0 ? 0 : acc.sentimentSum / acc.sentimentCount;

    return {
      region_id: regionId,
      total_heat_score: Number(acc.totalHeatScore.toFixed(3)),
      active_topics: acc.activeTopics,
      avg_sentiment: Number(avgSentiment.toFixed(4)),
      top_keywords: topKeywords(acc.keywordCounts, 10),
      sources_active: acc.sourceIds.size,
      sources_total: sourcesTotal,
      snapshot_at: nowIso,
    };
  });
}

function buildBatchInsert(
  tableName: string,
  columns: string[],
  rows: Array<Record<string, unknown>>,
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

async function runWithPostgres(pool: Pool, periodStartIso: string, nowIso: string, windowHours: number) {
  const allowedSourceIdsByRegion = buildAllowedSourceIdsByRegion();

  const { rows } = await pool.query<TopicSnapshotRow>(
    `
    select region_id,heat_score,sentiment,keywords,source_ids
    from topics
    where created_at >= $1
    `,
    [periodStartIso],
  );

  if (rows.length === 0) {
    log("No topic rows found in the target window. Snapshot build skipped.");
    return;
  }

  const filteredRows = rows.filter((row) => hasAllowedSource(row.region_id, row.source_ids, allowedSourceIdsByRegion));
  const payload = aggregateRows(filteredRows, nowIso);
  const columns = [
    "region_id",
    "total_heat_score",
    "active_topics",
    "avg_sentiment",
    "top_keywords",
    "sources_active",
    "sources_total",
    "snapshot_at",
  ];
  const batch = buildBatchInsert("region_snapshots", columns, payload);
  await pool.query(batch.sql, batch.values);

  log(`Snapshot build complete. db=postgres regions=${payload.length} windowHours=${windowHours}`);
}

async function main(): Promise<void> {
  const hours = Number.parseInt(parseArg("--hours") ?? "24", 10);
  const windowHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 168) : 24;

  const now = new Date();
  const nowIso = now.toISOString();
  const periodStartIso = new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString();

  if (!hasPostgresConfig()) {
    log("PostgreSQL configuration missing. Skipping snapshot build.");
    return;
  }

  const pool = createPostgresPool();
  await runWithPostgres(pool, periodStartIso, nowIso, windowHours);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
