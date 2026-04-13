import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("db-init");

interface MigrationRecord {
  filename: string;
  checksum: string;
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

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function ensureMigrationsTable(): Promise<void> {
  const pool = createPostgresPool();
  await pool.query(`
    create table if not exists schema_migrations (
      id bigserial primary key,
      filename text not null unique,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function listMigrations(migrationsDir: string): Promise<string[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function loadAppliedMigrations(): Promise<Map<string, string>> {
  const pool = createPostgresPool();
  const { rows } = await pool.query<MigrationRecord>(
    "select filename, checksum from schema_migrations order by filename asc",
  );
  return new Map(rows.map((row) => [row.filename, row.checksum]));
}

async function applyMigration(filename: string, sql: string, hash: string): Promise<void> {
  const pool = createPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      "insert into schema_migrations (filename, checksum) values ($1, $2)",
      [filename, hash],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const migrationsDirArg = parseArg("--dir");
  const dryRun = process.argv.includes("--dry-run");
  const migrationsDir =
    migrationsDirArg ?? path.join(process.cwd(), "db", "migrations");

  if (!hasPostgresConfig()) {
    log("PostgreSQL is not configured. Skipping migration run.");
    return;
  }

  await ensureMigrationsTable();
  const migrationFiles = await listMigrations(migrationsDir);
  const applied = await loadAppliedMigrations();

  if (migrationFiles.length === 0) {
    log(`No migration files found in ${migrationsDir}.`);
    return;
  }

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of migrationFiles) {
    const fullPath = path.join(migrationsDir, file);
    const sql = await readFile(fullPath, "utf8");
    const hash = checksum(sql);
    const existingHash = applied.get(file);

    if (existingHash) {
      if (existingHash !== hash) {
        throw new Error(
          `Checksum mismatch for already applied migration ${file}. expected=${existingHash} current=${hash}`,
        );
      }
      skippedCount += 1;
      log(`Skip already applied: ${file}`);
      continue;
    }

    if (dryRun) {
      appliedCount += 1;
      log(`Dry-run apply: ${file}`);
      continue;
    }

    await applyMigration(file, sql, hash);
    appliedCount += 1;
    log(`Applied: ${file}`);
  }

  log(`Migration completed. applied=${appliedCount} skipped=${skippedCount} dir=${migrationsDir}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
