import { spawn } from "node:child_process";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("verify-postgres");

interface CountRow {
  regions: string | number;
  sources: string | number;
  raw_posts: string | number;
  topics: string | number;
  global_topics: string | number;
  heat_history: string | number;
  region_snapshots: string | number;
}

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolveRunner(bin: string): string {
  return process.platform === "win32" ? `${bin}.cmd` : bin;
}

function log(message: string): void {
  logger.info(message);
}

async function runCommand(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(resolveRunner("npx"), args, {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${args.join(" ")}), exit=${code ?? -1}`));
    });
  });
}

async function assertRequiredTables(): Promise<void> {
  const pool = createPostgresPool();
  const required = [
    "regions",
    "sources",
    "raw_posts",
    "topics",
    "global_topics",
    "heat_history",
    "region_snapshots",
  ];

  const { rows } = await pool.query<{ table_name: string }>(
    `
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any($1::text[])
    `,
    [required],
  );

  const existing = new Set(rows.map((row) => row.table_name));
  const missing = required.filter((name) => !existing.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing required tables: ${missing.join(", ")}`);
  }
}

async function loadCounts(): Promise<CountRow> {
  const pool = createPostgresPool();
  const { rows } = await pool.query<CountRow>(`
    select
      (select count(*) from regions) as regions,
      (select count(*) from sources) as sources,
      (select count(*) from raw_posts) as raw_posts,
      (select count(*) from topics) as topics,
      (select count(*) from global_topics) as global_topics,
      (select count(*) from heat_history) as heat_history,
      (select count(*) from region_snapshots) as region_snapshots
  `);
  if (!rows[0]) {
    return {
      regions: 0,
      sources: 0,
      raw_posts: 0,
      topics: 0,
      global_topics: 0,
      heat_history: 0,
      region_snapshots: 0,
    };
  }
  return rows[0];
}

async function main(): Promise<void> {
  const strict = hasFlag("--strict");
  const skipJobs = hasFlag("--skip-jobs");
  const collectorSource = parseArg("--source") ?? "reddit_worldnews";

  if (!hasPostgresConfig()) {
    log("PostgreSQL config is missing. Skipping E2E verification.");
    return;
  }

  const pool = createPostgresPool();
  await pool.query("select 1");
  log("Connected to PostgreSQL.");

  await runCommand(["tsx", "scripts/init-db.ts"]);
  await assertRequiredTables();
  log("Required schema/tables are present.");

  if (!skipJobs) {
    await runCommand(["tsx", "scripts/seed-regions.ts"]);
    await runCommand(["tsx", "scripts/run-collector.ts", "--source", collectorSource]);
    await runCommand([
      "tsx",
      "scripts/run-analyzer.ts",
      "--hours",
      "6",
      "--with-global",
      "--global-hours",
      "24",
    ]);
    await runCommand(["tsx", "scripts/build-snapshots.ts", "--hours", "24"]);
    await runCommand(["tsx", "scripts/cleanup-old-data.ts"]);
  }

  const counts = await loadCounts();
  const summary = {
    regions: toNumber(counts.regions),
    sources: toNumber(counts.sources),
    raw_posts: toNumber(counts.raw_posts),
    topics: toNumber(counts.topics),
    global_topics: toNumber(counts.global_topics),
    heat_history: toNumber(counts.heat_history),
    region_snapshots: toNumber(counts.region_snapshots),
  };

  log(`Counts => ${JSON.stringify(summary)}`);

  if (strict) {
    if (summary.regions === 0 || summary.sources === 0) {
      throw new Error("Strict check failed: regions/sources must be seeded.");
    }
    if (!skipJobs && summary.raw_posts === 0) {
      throw new Error("Strict check failed: raw_posts is zero after collector run.");
    }
  }

  log("PostgreSQL E2E verification complete.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
