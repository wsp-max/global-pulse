import { spawn } from "node:child_process";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

interface RecoverySourceRow {
  id: string;
  region_id: string;
  last_error: string | null;
  last_scraped_at: string | null;
}

const logger = getLogger("ops-source-recovery");

function resolveRunner(bin: string): string {
  if (process.platform === "win32") {
    return `${bin}.cmd`;
  }
  return bin;
}

function toBool(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) {
    return fallback;
  }
  switch (raw.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
      reject(new Error(`Source recovery collector failed with exit code ${code ?? -1}`));
    });
  });
}

async function fetchRecoverySourceIds(limit: number): Promise<string[]> {
  const pool = createPostgresPool();
  const { rows } = await pool.query<RecoverySourceRow>(
    `
    select id, region_id, last_error, last_scraped_at
    from sources
    where is_active = false
      and last_error like 'auto_disabled_consecutive_failures%'
    order by last_scraped_at asc nulls first, id asc
    limit $1
    `,
    [limit],
  );

  return rows.map((row) => row.id);
}

async function main(): Promise<void> {
  const enabled = toBool(process.env.SOURCE_RECOVERY_ENABLED, true);
  if (!enabled) {
    logger.info("Source recovery disabled (SOURCE_RECOVERY_ENABLED=false).");
    return;
  }

  if (!hasPostgresConfig()) {
    logger.warn("Skipping source recovery: PostgreSQL is not configured.");
    return;
  }

  const limit = toPositiveInt(process.env.SOURCE_RECOVERY_LIMIT, 24);
  const batchSize = toPositiveInt(process.env.SOURCE_RECOVERY_BATCH_SIZE, 12);
  const sourceIds = await fetchRecoverySourceIds(limit);

  if (sourceIds.length === 0) {
    logger.info("No auto-disabled sources to verify.");
    return;
  }

  logger.info(`Recovery verification queued for ${sourceIds.length} auto-disabled sources.`);

  for (const batch of chunk(sourceIds, batchSize)) {
    const args = [
      "tsx",
      "scripts/run-collector.ts",
      "--allow-inactive",
      "--force",
      "--source",
      batch.join(","),
    ];
    logger.info(`Running recovery batch: ${batch.join(",")}`);
    await runCommand(resolveRunner("npx"), args);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
