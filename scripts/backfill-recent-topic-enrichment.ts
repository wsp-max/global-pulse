import { summarizeTopicsWithGemini } from "../packages/analyzer/src/gemini-summarizer";
import type { Topic } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

type AnalysisScope = "community" | "news" | "mixed";

interface TopicCandidateRow {
  id: number;
  region_id: string;
  scope: AnalysisScope | null;
  name_ko: string;
  name_en: string;
  keywords: string[] | null;
  sentiment: number | null;
  heat_score: number | null;
  post_count: number | null;
  total_views: number | null;
  total_likes: number | null;
  total_comments: number | null;
  source_ids: string[] | null;
  period_start: string;
  period_end: string;
  created_at: string;
}

interface BackfillTarget {
  row: TopicCandidateRow;
  topic: Topic;
}

const logger = getLogger("backfill-topic-enrichment");
const GEMINI_BATCH_SIZE = Math.min(
  Math.max(Number(process.env.ANALYZER_LLM_CANONICAL_BATCH ?? 12), 1),
  12,
);
const GEMINI_CALL_INTERVAL_MS = 120;

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseScope(raw: string | undefined): AnalysisScope | undefined {
  if (!raw) {
    return undefined;
  }
  if (raw === "community" || raw === "news" || raw === "mixed") {
    return raw;
  }
  throw new Error(`Invalid --scope value "${raw}". Allowed: community|news|mixed`);
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length <= size) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let cursor = 0; cursor < items.length; cursor += size) {
    chunks.push(items.slice(cursor, cursor + size));
  }
  return chunks;
}

function toBackfillTarget(row: TopicCandidateRow): BackfillTarget {
  const topic: Topic = {
    id: row.id,
    regionId: row.region_id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    keywords: row.keywords ?? [],
    sentiment: row.sentiment ?? 0,
    heatScore: toNumber(row.heat_score),
    postCount: toNumber(row.post_count),
    totalViews: toNumber(row.total_views),
    totalLikes: toNumber(row.total_likes),
    totalComments: toNumber(row.total_comments),
    sourceIds: row.source_ids ?? [],
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
  return { row, topic };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const limit = Math.min(toPositiveInt(parseArg("--limit"), 120), 500);
  const region = parseArg("--region");
  const scope = parseScope(parseArg("--scope"));

  if (!hasPostgresConfig()) {
    throw new Error(
      "PostgreSQL configuration missing. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.",
    );
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY is required for enrichment backfill.");
  }

  const pool = createPostgresPool();
  const params: Array<string | number> = [];
  const where: string[] = [
    "t.created_at >= now() - interval '48 hours'",
    "t.summary_ko is null",
  ];

  if (region) {
    params.push(region);
    where.push(`t.region_id = $${params.length}`);
  }

  if (scope) {
    params.push(scope);
    where.push(`coalesce(t.scope, 'community') = $${params.length}`);
  }

  params.push(limit);

  const { rows } = await pool.query<TopicCandidateRow>(
    `
    select
      t.id,
      t.region_id,
      t.scope,
      t.name_ko,
      t.name_en,
      t.keywords,
      t.sentiment,
      t.heat_score,
      t.post_count,
      t.total_views,
      t.total_likes,
      t.total_comments,
      t.source_ids,
      t.period_start,
      t.period_end,
      t.created_at
    from topics t
    where ${where.join(" and ")}
    order by t.created_at desc
    limit $${params.length}
    `,
    params,
  );

  if (rows.length === 0) {
    logger.info("No candidate topics found for enrichment backfill.");
    return;
  }

  const targets = rows.map(toBackfillTarget);
  const byRegion = new Map<string, BackfillTarget[]>();
  for (const item of targets) {
    const regionTargets = byRegion.get(item.row.region_id) ?? [];
    regionTargets.push(item);
    byRegion.set(item.row.region_id, regionTargets);
  }

  let scanned = 0;
  let updated = 0;
  let requestCount = 0;
  let fallbackCount = 0;
  const errors: string[] = [];

  for (const [regionId, regionTargets] of byRegion.entries()) {
    const batches = chunk(regionTargets, GEMINI_BATCH_SIZE);

    for (const batch of batches) {
      const topics = batch.map((item) => item.topic);
      const result = await summarizeTopicsWithGemini(topics, { regionId });

      scanned += batch.length;
      requestCount += result.stats.requestCount;
      fallbackCount += result.stats.fallbackCount;
      errors.push(...result.stats.errors);

      if (dryRun) {
        await sleep(GEMINI_CALL_INTERVAL_MS);
        continue;
      }

      for (let index = 0; index < batch.length; index += 1) {
        const row = batch[index]!.row;
        const enriched = result.topics[index];
        if (!enriched) {
          continue;
        }

        await pool.query(
          `
          update topics
          set
            summary_ko = $2,
            summary_en = $3,
            category = $4,
            entities = $5::jsonb,
            aliases = $6::text[],
            canonical_key = $7
          where id = $1
          `,
          [
            row.id,
            enriched.summaryKo ?? "요약 준비 중",
            enriched.summaryEn ?? "Summary pending",
            enriched.category ?? null,
            JSON.stringify(enriched.entities ?? []),
            enriched.aliases ?? [],
            enriched.canonicalKey ?? null,
          ],
        );
        updated += 1;
      }

      await sleep(GEMINI_CALL_INTERVAL_MS);
    }
  }

  logger.info(
    `Backfill done dryRun=${dryRun} scanned=${scanned} updated=${updated} geminiCalls=${requestCount} fallbacks=${fallbackCount} errors=${errors.length}`,
  );

  if (errors.length > 0) {
    logger.warn(`Backfill sample errors: ${errors.slice(0, 5).join(" | ")}`);
  }
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
