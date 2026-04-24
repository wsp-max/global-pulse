import { DISABLED_SOURCE_ID_SET, REGIONS, SOURCES } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";
import type { Source } from "@global-pulse/shared";
import type { Pool } from "pg";

const logger = getLogger("seed-regions");
const EXPANDED_REGION_IDS = new Set(["br", "in", "id", "mx", "au", "vn", "th", "ar", "ca", "ng", "za"]);
const ALL_SOURCES = SOURCES as readonly Source[];

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

async function seedWithPostgres(pool: Pool): Promise<void> {
  const sourceRows = ALL_SOURCES.map((source) => ({
    id: source.id,
    region_id: source.regionId,
    name: source.name,
    name_en: source.nameEn,
    url: source.url,
    type: source.type,
    scrape_url: source.scrapeUrl,
    scrape_interval_minutes: source.scrapeIntervalMinutes,
    news_category: source.newsCategory ?? null,
    trust_tier: source.trustTier ?? 3,
    language: source.language ?? null,
    feed_kind: source.feedKind ?? null,
    metro_hint: source.metroHint ?? null,
    is_active: source.isActive !== undefined ? source.isActive : !DISABLED_SOURCE_ID_SET.has(source.id),
  }));

  const regionRows = REGIONS.map((region) => {
    if (!EXPANDED_REGION_IDS.has(region.id)) {
      return {
        id: region.id,
        name_ko: region.nameKo,
        name_en: region.nameEn,
        flag_emoji: region.flagEmoji,
        timezone: region.timezone,
        color: region.color,
        sort_order: region.sortOrder,
        is_active: true,
      };
    }

    const activeSources = sourceRows.filter((source) => source.region_id === region.id && source.is_active);
    const hasCommunity = activeSources.some((source) => source.type === "community");
    const hasNews = activeSources.some((source) => source.type === "news");
    const isActive = hasCommunity && hasNews;

    return {
      id: region.id,
      name_ko: region.nameKo,
      name_en: region.nameEn,
      flag_emoji: region.flagEmoji,
      timezone: region.timezone,
      color: region.color,
      sort_order: region.sortOrder,
      is_active: isActive,
    };
  });
  const regionColumns: Array<keyof (typeof regionRows)[number] & string> = [
    "id",
    "name_ko",
    "name_en",
    "flag_emoji",
    "timezone",
    "color",
    "sort_order",
    "is_active",
  ];
  const regionBatch = buildBatchInsert("regions", regionColumns, regionRows);
  await pool.query(
    `
    ${regionBatch.sql}
    on conflict (id)
    do update
    set
      name_ko = excluded.name_ko,
      name_en = excluded.name_en,
      flag_emoji = excluded.flag_emoji,
      timezone = excluded.timezone,
      color = excluded.color,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active
    `,
    regionBatch.values,
  );

  const sourceColumns: Array<keyof (typeof sourceRows)[number] & string> = [
    "id",
    "region_id",
    "name",
    "name_en",
    "url",
    "type",
    "scrape_url",
    "scrape_interval_minutes",
    "news_category",
    "trust_tier",
    "language",
    "feed_kind",
    "metro_hint",
    "is_active",
  ];
  const sourceBatch = buildBatchInsert("sources", sourceColumns, sourceRows);
  // Keep runtime on/off state in DB (auto-disabled or operator override) when metadata is reseeded.
  await pool.query(
    `
    ${sourceBatch.sql}
    on conflict (id)
    do update
    set
      region_id = excluded.region_id,
      name = excluded.name,
      name_en = excluded.name_en,
      url = excluded.url,
      type = excluded.type,
      scrape_url = excluded.scrape_url,
      scrape_interval_minutes = excluded.scrape_interval_minutes,
      news_category = excluded.news_category,
      trust_tier = excluded.trust_tier,
      language = excluded.language,
      feed_kind = excluded.feed_kind,
      metro_hint = excluded.metro_hint
    `,
    sourceBatch.values,
  );

  const sourceIdList = ALL_SOURCES.map((source) => source.id);
  await pool.query(`update sources set is_active = false where not (id = any($1::text[]))`, [sourceIdList]);
}

async function run(): Promise<void> {
  if (!hasPostgresConfig()) {
    logger.warn("PostgreSQL configuration missing. Skipping seed.");
    return;
  }

  const pool = createPostgresPool();
  await seedWithPostgres(pool);
  logger.info(`Seed completed. db=postgres regions=${REGIONS.length}, sources=${ALL_SOURCES.length}`);
}

run().catch((error) => {
  logger.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

