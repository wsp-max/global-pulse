import fs from "node:fs/promises";
import path from "node:path";
import { REGIONS } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

type SourceType = "community" | "sns";
type ConnectivityState = "CONNECTED" | "ERROR" | "STALE" | "ZERO" | "DISABLED";

interface SourceRow {
  id: string;
  region_id: string;
  name: string;
  type: SourceType;
  is_active: boolean;
  scrape_interval_minutes: string | number | null;
  last_scraped_at: string | null;
  last_error: string | null;
  recent_count: string | number;
  total_count: string | number;
  latest_collected_at: string | null;
}

interface ReportRow {
  regionId: string;
  regionName: string;
  sourceId: string;
  sourceName: string;
  type: SourceType;
  isActive: boolean;
  recentCount: number;
  totalCount: number;
  lastCollectedAt: string | null;
  lastScrapedAt: string | null;
  status: ConnectivityState;
  lastError: string | null;
  action: string;
}

const logger = getLogger("source-connectivity-report");

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((value) => value === flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
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

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return timestamp;
}

function sanitizeCell(value: string | null | undefined, max = 120): string {
  if (!value) {
    return "-";
  }
  return value
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim()
    .slice(0, max);
}

function classifyStatus(row: SourceRow, staleMinutes: number): ConnectivityState {
  if (!row.is_active) {
    return "DISABLED";
  }

  const recentCount = toNumber(row.recent_count);
  if (recentCount > 0) {
    return "CONNECTED";
  }

  const latestCollectedAt = parseTime(row.latest_collected_at);
  if (latestCollectedAt) {
    const staleCutoff = Date.now() - staleMinutes * 60 * 1000;
    if (latestCollectedAt >= staleCutoff) {
      return "STALE";
    }
  }

  if (row.last_error && row.last_error.trim().length > 0) {
    return "ERROR";
  }

  return "ZERO";
}

function recommendAction(row: SourceRow, status: ConnectivityState): string {
  if (status === "CONNECTED") {
    return "No action (healthy in recent window).";
  }

  if (status === "DISABLED") {
    return "Disabled source. Enable only if needed.";
  }

  const message = (row.last_error ?? "").toLowerCase();
  if (row.id.startsWith("reddit")) {
    return "Configure Reddit OAuth and/or alternate egress IP.";
  }
  if (message.includes("youtube_api_key is missing")) {
    return "Set YOUTUBE_API_KEY in runtime env and restart collector.";
  }
  if (message.includes("403")) {
    return "Likely anti-bot/geo block. Use fallback feed or browser/proxy strategy.";
  }
  if (message.includes("430") || message.includes("429")) {
    return "Rate limit hit. Increase interval and keep cached/fallback path.";
  }
  if (status === "STALE") {
    return "Recently collected but no fresh rows. Re-run source and inspect drift.";
  }
  return "Run source-only collect and inspect last_error + journal logs.";
}

function formatMarkdown(
  rows: ReportRow[],
  generatedAt: string,
  minutes: number,
  staleMinutes: number,
): string {
  const activeRows = rows.filter((row) => row.isActive);
  const connected = activeRows.filter((row) => row.status === "CONNECTED").length;
  const error = activeRows.filter((row) => row.status === "ERROR").length;
  const stale = activeRows.filter((row) => row.status === "STALE").length;
  const zero = activeRows.filter((row) => row.status === "ZERO").length;
  const disabled = rows.filter((row) => !row.isActive).length;

  const lines: string[] = [];
  lines.push("# Source Connectivity Report");
  lines.push("");
  lines.push(`- generatedAt: ${generatedAt}`);
  lines.push(`- recentWindowMinutes: ${minutes}`);
  lines.push(`- staleWindowMinutes: ${staleMinutes}`);
  lines.push(`- totalSources: ${rows.length}`);
  lines.push(`- activeSources: ${activeRows.length}`);
  lines.push(`- connected: ${connected}`);
  lines.push(`- error: ${error}`);
  lines.push(`- stale: ${stale}`);
  lines.push(`- zero: ${zero}`);
  lines.push(`- disabled: ${disabled}`);
  lines.push("");
  lines.push(
    "| Region | Source ID | Source Name | Type | Active | Recent Rows | Total Rows | Last Collected | Last Scraped | Status | Last Error | Recommended Action |",
  );
  lines.push(
    "| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |",
  );

  for (const row of rows) {
    lines.push(
      `| ${sanitizeCell(`${row.regionName} (${row.regionId})`)} | ${sanitizeCell(row.sourceId)} | ${sanitizeCell(row.sourceName)} | ${row.type} | ${row.isActive ? "Y" : "N"} | ${row.recentCount} | ${row.totalCount} | ${sanitizeCell(row.lastCollectedAt)} | ${sanitizeCell(row.lastScrapedAt)} | ${row.status} | ${sanitizeCell(row.lastError, 140)} | ${sanitizeCell(row.action, 140)} |`,
    );
  }

  lines.push("");
  lines.push("## Priority Targets");
  const priority = rows
    .filter((row) => row.isActive && row.status !== "CONNECTED")
    .sort((a, b) => a.regionId.localeCompare(b.regionId) || a.sourceId.localeCompare(b.sourceId))
    .slice(0, 20);
  if (priority.length === 0) {
    lines.push("- None. All active sources are connected.");
  } else {
    for (const row of priority) {
      lines.push(`- ${row.sourceId} (${row.regionId}): ${row.status} -> ${row.action}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const minutes = toPositiveInt(parseArg("--minutes"), 180);
  const staleMinutes = toPositiveInt(parseArg("--stale-minutes"), 720);
  const outPath = path.resolve(parseArg("--out") ?? path.join("docs", "source-notes", "source-connectivity-report.md"));
  const includeDisabled = process.argv.includes("--include-disabled");
  const regionFilter = new Set(parseList(parseArg("--regions")));
  const printJson = process.argv.includes("--print-json");

  if (!hasPostgresConfig()) {
    throw new Error(
      "PostgreSQL configuration missing. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.",
    );
  }

  const pool = createPostgresPool();
  const regionNameMap = new Map<string, string>(REGIONS.map((region) => [region.id, region.nameEn]));

  const whereClauses: string[] = [];
  const params: Array<number | string[] | boolean> = [minutes];
  let paramIndex = params.length + 1;

  if (!includeDisabled) {
    whereClauses.push("s.is_active = true");
  }

  if (regionFilter.size > 0) {
    whereClauses.push(`s.region_id = any($${paramIndex}::text[])`);
    params.push([...regionFilter]);
    paramIndex += 1;
  }

  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(" and ")}` : "";

  const { rows } = await pool.query<SourceRow>(
    `
    with recent as (
      select
        source_id,
        count(*) as recent_count,
        max(collected_at) as latest_collected_at
      from raw_posts
      where collected_at >= now() - make_interval(mins => $1::int)
      group by source_id
    ),
    total as (
      select
        source_id,
        count(*) as total_count
      from raw_posts
      group by source_id
    )
    select
      s.id,
      s.region_id,
      s.name,
      s.type,
      s.is_active,
      s.scrape_interval_minutes,
      s.last_scraped_at,
      s.last_error,
      coalesce(recent.recent_count, 0) as recent_count,
      coalesce(total.total_count, 0) as total_count,
      recent.latest_collected_at
    from sources s
    left join recent on recent.source_id = s.id
    left join total on total.source_id = s.id
    ${whereSql}
    order by s.region_id asc, s.id asc
    `,
    params,
  );

  const reportRows: ReportRow[] = rows.map((row) => {
    const status = classifyStatus(row, staleMinutes);
    return {
      regionId: row.region_id,
      regionName: regionNameMap.get(row.region_id) ?? row.region_id.toUpperCase(),
      sourceId: row.id,
      sourceName: row.name,
      type: row.type,
      isActive: row.is_active,
      recentCount: toNumber(row.recent_count),
      totalCount: toNumber(row.total_count),
      lastCollectedAt: row.latest_collected_at,
      lastScrapedAt: row.last_scraped_at,
      status,
      lastError: row.last_error,
      action: recommendAction(row, status),
    };
  });

  const markdown = formatMarkdown(reportRows, new Date().toISOString(), minutes, staleMinutes);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, markdown, "utf8");

  const summary = {
    outPath: outPath.replace(/\\/g, "/"),
    totalSources: reportRows.length,
    activeSources: reportRows.filter((row) => row.isActive).length,
    connected: reportRows.filter((row) => row.status === "CONNECTED").length,
    error: reportRows.filter((row) => row.status === "ERROR").length,
    stale: reportRows.filter((row) => row.status === "STALE").length,
    zero: reportRows.filter((row) => row.status === "ZERO").length,
    disabled: reportRows.filter((row) => row.status === "DISABLED").length,
  };

  if (printJson) {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } else {
    logger.info(`Connectivity report written: ${summary.outPath}`);
    logger.info(
      `Summary total=${summary.totalSources} active=${summary.activeSources} connected=${summary.connected} error=${summary.error} stale=${summary.stale} zero=${summary.zero} disabled=${summary.disabled}`,
    );
  }
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
