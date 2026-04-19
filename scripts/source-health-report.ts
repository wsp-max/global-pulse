import fs from "node:fs/promises";
import path from "node:path";
import { REGIONS } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

type OutputFormat = "md" | "json";

interface SourceHealthRow {
  id: string;
  region_id: string;
  name: string;
  type: "community" | "sns" | "news";
  is_active: boolean;
  last_scraped_at: string | null;
  last_error: string | null;
  recent_count: number | string | null;
  latest_collected_at: string | null;
}

interface ReportRow {
  sourceId: string;
  regionId: string;
  regionName: string;
  name: string;
  type: "community" | "sns" | "news";
  isActive: boolean;
  recent24hCount: number;
  lastScrapedAt: string | null;
  latestCollectedAt: string | null;
  lastError: string | null;
  status: "connected" | "degraded";
}

const logger = getLogger("source-health-report");

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

function toOutputFormat(raw: string | undefined): OutputFormat {
  return raw === "json" ? "json" : "md";
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

function toReportRows(rows: SourceHealthRow[]): ReportRow[] {
  const regionNameById = new Map<string, string>(REGIONS.map((region) => [region.id, region.nameEn]));
  return rows.map((row) => {
    const recent24hCount = toNumber(row.recent_count);
    return {
      sourceId: row.id,
      regionId: row.region_id,
      regionName: regionNameById.get(row.region_id) ?? row.region_id.toUpperCase(),
      name: row.name,
      type: row.type,
      isActive: row.is_active,
      recent24hCount,
      lastScrapedAt: row.last_scraped_at,
      latestCollectedAt: row.latest_collected_at,
      lastError: row.last_error,
      status: recent24hCount >= 1 ? "connected" : "degraded",
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

function formatMarkdown(rows: ReportRow[], generatedAt: string, hours: number): string {
  const total = rows.length;
  const active = rows.filter((row) => row.isActive).length;
  const connected = rows.filter((row) => row.status === "connected").length;
  const degraded = total - connected;

  const lines: string[] = [];
  lines.push("# Source Health Report");
  lines.push("");
  lines.push(`- generatedAt: ${generatedAt}`);
  lines.push(`- windowHours: ${hours}`);
  lines.push(`- totalSources: ${total}`);
  lines.push(`- activeSources: ${active}`);
  lines.push(`- connected: ${connected}`);
  lines.push(`- degraded: ${degraded}`);
  lines.push("");
  lines.push(
    "| Region | Source ID | Name | Type | Active | Count (24h) | Last Collected | Last Scraped | Last Error | Status |",
  );
  lines.push("| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |");

  for (const row of rows) {
    lines.push(
      `| ${sanitizeCell(`${row.regionName} (${row.regionId})`)} | ${sanitizeCell(row.sourceId)} | ${sanitizeCell(row.name)} | ${row.type} | ${row.isActive ? "Y" : "N"} | ${row.recent24hCount} | ${sanitizeCell(row.latestCollectedAt)} | ${sanitizeCell(row.lastScrapedAt)} | ${sanitizeCell(row.lastError, 160)} | ${row.status} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

async function activateLiveSources(regionFilter: string | undefined, hours: number): Promise<number> {
  const pool = createPostgresPool();
  const params: Array<string | number> = [hours];
  let regionClause = "";

  if (regionFilter) {
    params.push(regionFilter);
    regionClause = "and s.region_id = $2";
  }

  const { rowCount } = await pool.query(
    `
    with recent as (
      select source_id, count(*) as recent_count
      from raw_posts
      where collected_at >= now() - make_interval(hours => $1::int)
      group by source_id
    )
    update sources s
    set
      is_active = coalesce((recent.recent_count >= 1), false)
    from recent
    where s.id = recent.source_id
      ${regionClause}
    `,
    params,
  );

  if (!regionFilter) {
    await pool.query(
      `
      update sources s
      set is_active = false
      where not exists (
        select 1
        from raw_posts rp
        where rp.source_id = s.id
          and rp.collected_at >= now() - make_interval(hours => $1::int)
      )
      `,
      [hours],
    );
  } else {
    await pool.query(
      `
      update sources s
      set is_active = false
      where s.region_id = $2
        and not exists (
          select 1
          from raw_posts rp
          where rp.source_id = s.id
            and rp.collected_at >= now() - make_interval(hours => $1::int)
        )
      `,
      [hours, regionFilter],
    );
  }

  return rowCount ?? 0;
}

async function main(): Promise<void> {
  const format = toOutputFormat(parseArg("--format"));
  const regionFilter = parseArg("--region");
  const hours = toPositiveInt(parseArg("--hours"), 24);
  const printOnly = process.argv.includes("--print");
  const activateLive = process.argv.includes("--activate-live");
  const confirm = process.argv.includes("--confirm");
  const outPath = path.resolve(
    parseArg("--out") ?? path.join("docs", "source-notes", `source-health-report.${format === "md" ? "md" : "json"}`),
  );

  if (!hasPostgresConfig()) {
    throw new Error(
      "PostgreSQL configuration missing. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.",
    );
  }

  if (activateLive && !confirm) {
    throw new Error("Refusing activation update without --confirm.");
  }

  if (activateLive) {
    const touched = await activateLiveSources(regionFilter, hours);
    logger.info(
      `Live activation applied: region=${regionFilter ?? "all"} window=${hours}h touched=${touched} (recent>=1 => active)`,
    );
  }

  const pool = createPostgresPool();
  const params: Array<string | number> = [hours];
  let whereClause = "";
  if (regionFilter) {
    whereClause = "where s.region_id = $2";
    params.push(regionFilter);
  }

  const { rows } = await pool.query<SourceHealthRow>(
    `
    with recent as (
      select source_id, count(*) as recent_count, max(collected_at) as latest_collected_at
      from raw_posts
      where collected_at >= now() - make_interval(hours => $1::int)
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
      coalesce(recent.recent_count, 0) as recent_count,
      recent.latest_collected_at
    from sources s
    left join recent on recent.source_id = s.id
    ${whereClause}
    order by s.region_id asc, s.id asc
    `,
    params,
  );

  const reportRows = toReportRows(rows);

  if (format === "json") {
    const payload = {
      generatedAt: new Date().toISOString(),
      windowHours: hours,
      region: regionFilter ?? "all",
      rows: reportRows,
      summary: {
        totalSources: reportRows.length,
        activeSources: reportRows.filter((row) => row.isActive).length,
        connected: reportRows.filter((row) => row.status === "connected").length,
        degraded: reportRows.filter((row) => row.status === "degraded").length,
      },
    };

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

  const markdown = formatMarkdown(reportRows, new Date().toISOString(), hours);
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
