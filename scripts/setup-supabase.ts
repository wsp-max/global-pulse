import fs from "node:fs/promises";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:setup-supabase");

async function run(): Promise<void> {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter((name) => name.endsWith(".sql")).sort();

  logger.info({ migrationCount: sqlFiles.length }, "supabase_setup_migrations_listed");
  process.stdout.write("Global Pulse Supabase Setup\n");
  process.stdout.write("Apply the following migrations in order using Supabase SQL editor or CLI:\n");
  for (const fileName of sqlFiles) {
    process.stdout.write(`- ${fileName}\n`);
  }
}

run().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "supabase_setup_failed",
  );
  process.exit(1);
});

