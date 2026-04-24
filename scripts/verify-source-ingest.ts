import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("verify-source-ingest");

interface SourceCountRow {
  source_id: string;
  count: string | number;
  latest_collected_at: string | null;
}

interface SourceSampleRow {
  source_id: string;
  title: string;
  url: string | null;
  collected_at: string;
}

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((value) => value === flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseListArg(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) {
    return fallback;
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

async function main(): Promise<void> {
  const sources = parseListArg(parseArg("--sources"), ["bilibili", "mastodon_eu"]);
  const minutes = toPositiveInt(parseArg("--minutes"), 60);
  const sampleLimit = Math.min(toPositiveInt(parseArg("--samples"), 3), 10);
  const allowEmpty = process.argv.includes("--allow-empty");

  if (!hasPostgresConfig()) {
    throw new Error(
      "PostgreSQL configuration missing. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.",
    );
  }

  const pool = createPostgresPool();

  const countResult = await pool.query<SourceCountRow>(
    `
    select
      source_id,
      count(*) as count,
      max(collected_at) as latest_collected_at
    from raw_posts
    where source_id = any($1::text[])
      and collected_at >= now() - make_interval(mins => $2::int)
    group by source_id
    order by source_id
    `,
    [sources, minutes],
  );

  const sampleResult = await pool.query<SourceSampleRow>(
    `
    select source_id,title,url,collected_at
    from (
      select
        source_id,
        title,
        url,
        collected_at,
        row_number() over (partition by source_id order by collected_at desc, id desc) as rn
      from raw_posts
      where source_id = any($1::text[])
    ) ranked
    where rn <= $2
    order by source_id, collected_at desc
    `,
    [sources, sampleLimit],
  );

  const countBySource = new Map<string, SourceCountRow>();
  for (const row of countResult.rows) {
    countBySource.set(row.source_id, row);
  }

  const missing: string[] = [];
  for (const sourceId of sources) {
    const row = countBySource.get(sourceId);
    const count = Number(row?.count ?? 0);
    if (count <= 0) {
      missing.push(sourceId);
    }
  }

  const samplesBySource = new Map<string, SourceSampleRow[]>();
  for (const row of sampleResult.rows) {
    if (!samplesBySource.has(row.source_id)) {
      samplesBySource.set(row.source_id, []);
    }
    samplesBySource.get(row.source_id)?.push(row);
  }

  logger.info(
    `window=${minutes}m sources=${sources.join(",")} counts=${JSON.stringify(
      countResult.rows.map((row) => ({
        sourceId: row.source_id,
        count: Number(row.count),
        latestCollectedAt: row.latest_collected_at,
      })),
    )}`,
  );

  for (const sourceId of sources) {
    const sampleRows = samplesBySource.get(sourceId) ?? [];
    if (sampleRows.length === 0) {
      logger.info(`[${sourceId}] sample: no rows`);
      continue;
    }

    const samplePreview = sampleRows.map((row) => ({
      title: row.title.slice(0, 120),
      url: row.url ?? "",
      collectedAt: row.collected_at,
    }));
    logger.info(`[${sourceId}] sample=${JSON.stringify(samplePreview)}`);
  }

  if (missing.length > 0 && !allowEmpty) {
    throw new Error(
      `No ingested rows in the last ${minutes} minutes for: ${missing.join(", ")} (use --allow-empty to bypass)`,
    );
  }
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
