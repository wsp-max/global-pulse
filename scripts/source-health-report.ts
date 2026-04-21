import fs from "node:fs/promises";
import path from "node:path";
import { REGIONS, SOURCES } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

type OutputFormat = "md" | "json";
type SourceStatus = "active" | "inactive" | "recently-connected" | "degraded";

interface SourceHealthDbRow {
  id: string;
  region_id: string;
  name: string;
  type: "community" | "sns" | "news";
  is_active: boolean;
  last_scraped_at: string | null;
  last_error: string | null;
  recent_24h_count: number | string | null;
  recent_7d_count: number | string | null;
  recent_status_count: number | string | null;
  latest_collected_at: string | null;
}

interface RegionSnapshotRow {
  region_id: string;
  total_heat_score: number | string | null;
  active_topics: number | string | null;
  avg_sentiment: number | string | null;
  top_keywords: string[] | null;
  sources_active: number | string | null;
  sources_total: number | string | null;
  snapshot_at: string | null;
  scope: "community" | "news" | "mixed" | null;
}

interface ReportRow {
  sourceId: string;
  regionId: string;
  regionName: string;
  name: string;
  type: "community" | "sns" | "news";
  isActive: boolean;
  last24hCount: number | null;
  last7dCount: number | null;
  latestCollectedAt: string | null;
  lastScrapedAt: string | null;
  lastError: string | null;
  status: SourceStatus;
}

interface RegionSummary {
  regionId: string;
  regionName: string;
  snapshotAt: string | null;
  totalHeatScore: number | null;
  activeTopics: number | null;
  avgSentiment: number | null;
  topKeywords: string[];
  sourcesActive: number;
  sourcesTotal: number;
  snapshotAvailable: boolean;
  scope: "community" | "news" | "mixed" | null;
}

const logger = getLogger("source-health-report");
const DEFAULT_FOCUS_REGION_IDS = ["us", "kr", "cn", "jp"] as const;

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseListArg(...flags: string[]): string[] {
  const values = flags.flatMap((flag) => {
    const raw = parseArg(flag);
    if (!raw) {
      return [];
    }
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });

  return [...new Set(values)];
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function toOutputFormat(raw: string | undefined): OutputFormat {
  return raw === "json" ? "json" : "md";
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getRegionName(regionId: string): string {
  return REGIONS.find((region) => region.id === regionId)?.nameEn ?? regionId.toUpperCase();
}

function getRegionIds(): string[] {
  if (process.argv.includes("--all")) {
    return REGIONS.map((region) => region.id);
  }

  const explicit = parseListArg("--region", "--regions");
  if (explicit.length > 0) {
    return explicit;
  }

  return [...DEFAULT_FOCUS_REGION_IDS];
}

function deriveStatus(isActive: boolean, recentStatusCount: number | null): SourceStatus {
  if (!isActive) {
    return "inactive";
  }

  if ((recentStatusCount ?? 0) >= 1) {
    return "recently-connected";
  }

  return "degraded";
}

function toReportRows(rows: SourceHealthDbRow[], statusHours: number): ReportRow[] {
  return rows.map((row) => ({
    sourceId: row.id,
    regionId: row.region_id,
    regionName: getRegionName(row.region_id),
    name: row.name,
    type: row.type,
    isActive: row.is_active,
    last24hCount: toNullableNumber(row.recent_24h_count),
    last7dCount: toNullableNumber(row.recent_7d_count),
    latestCollectedAt: row.latest_collected_at,
    lastScrapedAt: row.last_scraped_at,
    lastError: row.last_error,
    status: deriveStatus(row.is_active, statusHours === 24 ? toNullableNumber(row.recent_24h_count) : toNullableNumber(row.recent_status_count)),
  }));
}

function buildFallbackRows(regionIds: string[]): ReportRow[] {
  return SOURCES.filter((source) => regionIds.includes(source.regionId)).map((source) => {
    const isActive = !("isActive" in source) || source.isActive !== false;

    return {
      sourceId: source.id,
      regionId: source.regionId,
      regionName: getRegionName(source.regionId),
      name: source.nameEn,
      type: source.type,
      isActive,
      last24hCount: null,
      last7dCount: null,
      latestCollectedAt: null,
      lastScrapedAt: null,
      lastError: null,
      status: isActive ? "active" : "inactive",
    };
  });
}

function buildRegionSummaries(rows: ReportRow[], snapshots: RegionSnapshotRow[] = []): RegionSummary[] {
  const snapshotByRegionId = new Map<string, RegionSnapshotRow>(snapshots.map((snapshot) => [snapshot.region_id, snapshot]));

  return [...new Set(rows.map((row) => row.regionId))].map((regionId) => {
    const regionRows = rows.filter((row) => row.regionId === regionId);
    const snapshot = snapshotByRegionId.get(regionId);

    return {
      regionId,
      regionName: getRegionName(regionId),
      snapshotAt: snapshot?.snapshot_at ?? null,
      totalHeatScore: toNullableNumber(snapshot?.total_heat_score),
      activeTopics: toNullableNumber(snapshot?.active_topics),
      avgSentiment: toNullableNumber(snapshot?.avg_sentiment),
      topKeywords: snapshot?.top_keywords ?? [],
      sourcesActive: snapshot ? toNullableNumber(snapshot.sources_active) ?? 0 : regionRows.filter((row) => row.isActive).length,
      sourcesTotal: snapshot ? toNullableNumber(snapshot.sources_total) ?? regionRows.length : regionRows.length,
      snapshotAvailable: Boolean(snapshot?.snapshot_at),
      scope: snapshot?.scope ?? null,
    };
  });
}

function sanitizeCell(value: unknown, max = 120): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return String(value)
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim()
    .slice(0, max);
}

function formatMarkdown(
  rows: ReportRow[],
  regionSummaries: RegionSummary[],
  generatedAt: string,
  statusHours: number,
  dbConfigured: boolean,
): string {
  const lines: string[] = [];
  lines.push("# Source Health Report");
  lines.push("");
  lines.push(`- generatedAt: ${generatedAt}`);
  lines.push(`- dbConfigured: ${dbConfigured}`);
  lines.push(`- recentStatusWindowHours: ${statusHours}`);
  lines.push(`- totalSources: ${rows.length}`);
  lines.push(`- activeSources: ${rows.filter((row) => row.isActive).length}`);
  lines.push(`- recentlyConnected: ${rows.filter((row) => row.status === "recently-connected").length}`);
  lines.push(`- degraded: ${rows.filter((row) => row.status === "degraded").length}`);
  lines.push(`- inactive: ${rows.filter((row) => row.status === "inactive").length}`);
  lines.push("");
  lines.push("## Region Summary");
  lines.push("");
  lines.push("| Region | Snapshot At | Heat | Active Topics | Avg Sentiment | Sources Active | Sources Total | Scope |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const summary of regionSummaries) {
    lines.push(
      `| ${sanitizeCell(`${summary.regionName} (${summary.regionId})`)} | ${sanitizeCell(summary.snapshotAt)} | ${sanitizeCell(summary.totalHeatScore)} | ${sanitizeCell(summary.activeTopics)} | ${sanitizeCell(summary.avgSentiment)} | ${summary.sourcesActive} | ${summary.sourcesTotal} | ${sanitizeCell(summary.scope)} |`,
    );
  }
  lines.push("");
  lines.push("## Source Detail");
  lines.push("");
  lines.push(
    "| Region | Source ID | Name | Type | Active | Count (24h) | Count (7d) | Latest Collected | Last Scraped | Last Error | Status |",
  );
  lines.push("| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${sanitizeCell(`${row.regionName} (${row.regionId})`)} | ${sanitizeCell(row.sourceId)} | ${sanitizeCell(row.name)} | ${row.type} | ${row.isActive ? "Y" : "N"} | ${sanitizeCell(row.last24hCount)} | ${sanitizeCell(row.last7dCount)} | ${sanitizeCell(row.latestCollectedAt)} | ${sanitizeCell(row.lastScrapedAt)} | ${sanitizeCell(row.lastError, 160)} | ${row.status} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

async function activateLiveSources(regionIds: string[], hours: number): Promise<number> {
  if (!hasPostgresConfig()) {
    throw new Error("Cannot apply live activation without PostgreSQL configuration.");
  }

  const pool = createPostgresPool();
  const { rowCount } = await pool.query(
    `
    update sources s
    set is_active = exists (
      select 1
      from raw_posts rp
      where rp.source_id = s.id
        and rp.collected_at >= now() - make_interval(hours => $2::int)
    )
    where s.region_id = any($1::text[])
    `,
    [regionIds, hours],
  );

  return rowCount ?? 0;
}

async function fetchDbRows(regionIds: string[], statusHours: number): Promise<SourceHealthDbRow[]> {
  const pool = createPostgresPool();
  const { rows } = await pool.query<SourceHealthDbRow>(
    `
    with source_counts as (
      select
        source_id,
        count(*) filter (where collected_at >= now() - interval '24 hours') as recent_24h_count,
        count(*) filter (where collected_at >= now() - interval '7 days') as recent_7d_count,
        count(*) filter (where collected_at >= now() - make_interval(hours => $2::int)) as recent_status_count,
        max(collected_at) as latest_collected_at
      from raw_posts
      group by source_id
    )
    select
      s.id,
      s.region_id,
      s.name,
      s.type,
      s.is_active,
      s.last_scraped_at,
      s.last_error,
      coalesce(sc.recent_24h_count, 0) as recent_24h_count,
      coalesce(sc.recent_7d_count, 0) as recent_7d_count,
      coalesce(sc.recent_status_count, 0) as recent_status_count,
      sc.latest_collected_at
    from sources s
    left join source_counts sc on sc.source_id = s.id
    where s.region_id = any($1::text[])
    order by s.region_id asc, s.id asc
    `,
    [regionIds, statusHours],
  );

  return rows;
}

async function fetchRegionSnapshots(regionIds: string[]): Promise<RegionSnapshotRow[]> {
  const pool = createPostgresPool();
  const { rows } = await pool.query<RegionSnapshotRow>(
    `
    select distinct on (region_id)
      region_id,
      total_heat_score,
      active_topics,
      avg_sentiment,
      top_keywords,
      sources_active,
      sources_total,
      snapshot_at,
      scope
    from region_snapshots
    where region_id = any($1::text[])
    order by region_id asc, snapshot_at desc
    `,
    [regionIds],
  );

  return rows;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const format = toOutputFormat(parseArg("--format"));
  const regionIds = getRegionIds();
  const statusHours = toPositiveInt(parseArg("--hours"), 24);
  const printOnly = process.argv.includes("--print");
  const activateLive = process.argv.includes("--activate-live");
  const confirm = process.argv.includes("--confirm");
  const outPath = path.resolve(
    parseArg("--out") ?? path.join("docs", "source-notes", `source-health-report.${format === "md" ? "md" : "json"}`),
  );

  if (activateLive && !confirm) {
    throw new Error("Refusing activation update without --confirm.");
  }

  if (activateLive) {
    const touched = await activateLiveSources(regionIds, statusHours);
    logger.info(
      `Live activation applied: regions=${regionIds.join(",")} window=${statusHours}h touched=${touched} (recent>=1 => active)`,
    );
  }

  let rows: ReportRow[];
  let regionSummaries: RegionSummary[];
  const dbConfigured = hasPostgresConfig();

  if (!dbConfigured) {
    rows = buildFallbackRows(regionIds).sort(
      (a, b) => a.regionId.localeCompare(b.regionId) || a.sourceId.localeCompare(b.sourceId),
    );
    regionSummaries = buildRegionSummaries(rows);
  } else {
    const dbRows = await fetchDbRows(regionIds, statusHours);
    rows = toReportRows(dbRows, statusHours);

    let snapshots: RegionSnapshotRow[] = [];
    try {
      snapshots = await fetchRegionSnapshots(regionIds);
    } catch (error) {
      logger.warn(
        `region_snapshots unavailable for source health report: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    regionSummaries = buildRegionSummaries(rows, snapshots);
  }

  const payload = {
    generatedAt,
    dbConfigured,
    regions: regionIds,
    recentStatusWindowHours: statusHours,
    summary: {
      totalSources: rows.length,
      activeSources: rows.filter((row) => row.isActive).length,
      recentlyConnected: rows.filter((row) => row.status === "recently-connected").length,
      degraded: rows.filter((row) => row.status === "degraded").length,
      inactive: rows.filter((row) => row.status === "inactive").length,
    },
    regionSummaries,
    rows,
  };

  if (format === "json") {
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    if (printOnly) {
      process.stdout.write(json);
      return;
    }

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, json, "utf8");
    logger.info(`Source health report written: ${outPath.replace(/\\/g, "/")}`);
    return;
  }

  const markdown = formatMarkdown(rows, regionSummaries, generatedAt, statusHours, dbConfigured);
  if (printOnly) {
    process.stdout.write(markdown);
    return;
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, markdown, "utf8");
  logger.info(`Source health report written: ${outPath.replace(/\\/g, "/")}`);
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
