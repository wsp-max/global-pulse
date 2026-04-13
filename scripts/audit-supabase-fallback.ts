import fs from "node:fs/promises";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:audit-supabase-fallback");

type MatchType =
  | "createSupabaseServiceClient"
  | "getSupabaseServiceClientOrNull"
  | "ENABLE_SUPABASE_FALLBACK"
  | "SUPABASE_ENV";

interface MatchEntry {
  file: string;
  line: number;
  type: MatchType;
  snippet: string;
}

const TARGET_DIRS = ["app", "packages", "scripts"];
const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
const EXCLUDED_RELATIVE_FILES = new Set([
  "scripts/audit-supabase-fallback.ts",
  "scripts/check-supabase-fallback-budget.ts",
]);

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((value) => value === flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function walkFiles(root: string, directory: string): Promise<string[]> {
  const base = path.resolve(root, directory);
  const files: string[] = [];

  async function recurse(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await recurse(full);
        continue;
      }
      if (entry.isFile() && TARGET_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(full);
      }
    }
  }

  await recurse(base);
  return files;
}

function matchLine(line: string): MatchType[] {
  const matches: MatchType[] = [];
  if (line.includes("createSupabaseServiceClient")) {
    matches.push("createSupabaseServiceClient");
  }
  if (line.includes("getSupabaseServiceClientOrNull")) {
    matches.push("getSupabaseServiceClientOrNull");
  }
  if (line.includes("ENABLE_SUPABASE_FALLBACK")) {
    matches.push("ENABLE_SUPABASE_FALLBACK");
  }
  if (line.includes("SUPABASE_URL") || line.includes("SUPABASE_SERVICE_KEY") || line.includes("SUPABASE_ANON_KEY")) {
    matches.push("SUPABASE_ENV");
  }
  return matches;
}

function classifyEntry(entry: MatchEntry): keyof ReturnType<typeof createBuckets> {
  const file = entry.file.replace(/\\/g, "/");
  if (file.startsWith("app/api/")) {
    return "apiFallback";
  }
  if (file.startsWith("packages/collector/") || file.startsWith("packages/analyzer/") || file.startsWith("scripts/")) {
    return "batchFallback";
  }
  if (file.startsWith("packages/shared/")) {
    return "sharedCore";
  }
  return "other";
}

function createBuckets() {
  return {
    apiFallback: {
      title: "API Fallback Paths",
      description: "Routes and API shared modules still referencing Supabase fallback.",
      entries: [] as MatchEntry[],
    },
    batchFallback: {
      title: "Batch/Script Fallback Paths",
      description: "Collector/analyzer/ops scripts referencing Supabase service client paths.",
      entries: [] as MatchEntry[],
    },
    sharedCore: {
      title: "Shared Core",
      description: "Shared Supabase client and fallback flag handling.",
      entries: [] as MatchEntry[],
    },
    other: {
      title: "Other References",
      description: "Non-core references requiring manual review.",
      entries: [] as MatchEntry[],
    },
  };
}

function buildReport(
  generatedAt: string,
  allEntries: MatchEntry[],
  buckets: ReturnType<typeof createBuckets>,
): string {
  const lines: string[] = [];
  lines.push("# Supabase Fallback Audit");
  lines.push("");
  lines.push(`- generated_at: ${generatedAt}`);
  lines.push(`- total_matches: ${allEntries.length}`);
  lines.push("");
  lines.push("## Match Counts By Type");

  const countByType = new Map<MatchType, number>();
  for (const entry of allEntries) {
    countByType.set(entry.type, (countByType.get(entry.type) ?? 0) + 1);
  }
  const orderedTypes: MatchType[] = [
    "createSupabaseServiceClient",
    "getSupabaseServiceClientOrNull",
    "ENABLE_SUPABASE_FALLBACK",
    "SUPABASE_ENV",
  ];
  for (const type of orderedTypes) {
    lines.push(`- ${type}: ${countByType.get(type) ?? 0}`);
  }
  lines.push("");

  if (allEntries.length === 0) {
    lines.push("## Retirement Status");
    lines.push("All tracked Supabase fallback references are retired in runtime code.");
    lines.push("");
    lines.push("## Guard Checklist");
    lines.push("1. Keep `docs/source-notes/supabase-fallback-budget.json` baseline at `0`.");
    lines.push("2. Run `npm run ops:supabase:audit` and `npm run ops:supabase:budget -- --print-json` after major refactors.");
    lines.push("3. Treat any new match as a regression unless explicitly approved.");
  } else {
    lines.push("## Retirement Checklist (Suggested Order)");
    lines.push("1. Remove batch/script Supabase fallbacks after EC2 closure stability window.");
    lines.push("2. Remove API Supabase fallback branches and keep PostgreSQL-only path.");
    lines.push("3. Remove shared Supabase service client runtime exports and env dependencies.");
    lines.push("4. Clean docs/env examples of legacy Supabase runtime requirements.");
  }
  lines.push("");

  const bucketOrder: Array<keyof ReturnType<typeof createBuckets>> = [
    "apiFallback",
    "batchFallback",
    "sharedCore",
    "other",
  ];

  for (const key of bucketOrder) {
    const bucket = buckets[key];
    lines.push(`## ${bucket.title}`);
    lines.push(bucket.description);
    if (bucket.entries.length === 0) {
      lines.push("- (none)");
      lines.push("");
      continue;
    }

    const dedup = new Set<string>();
    for (const entry of bucket.entries) {
      const item = `- ${entry.file}:${entry.line} [${entry.type}] ${entry.snippet}`;
      if (!dedup.has(item)) {
        dedup.add(item);
        lines.push(item);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const root = process.cwd();
  const outArg = parseArg("--out");
  const outPath = path.resolve(outArg ?? path.join("docs", "source-notes", "supabase-fallback-audit.md"));

  const files = (
    await Promise.all(TARGET_DIRS.map((directory) => walkFiles(root, directory)))
  ).flat();

  const entries: MatchEntry[] = [];
  for (const filePath of files) {
    const relative = path.relative(root, filePath).replace(/\\/g, "/");
    if (EXCLUDED_RELATIVE_FILES.has(relative)) {
      continue;
    }
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const types = matchLine(line);
      for (const type of types) {
        entries.push({
          file: relative,
          line: index + 1,
          type,
          snippet: line.trim().slice(0, 180),
        });
      }
    });
  }

  const buckets = createBuckets();
  for (const entry of entries) {
    buckets[classifyEntry(entry)].entries.push(entry);
  }

  const generatedAt = new Date().toISOString();
  const report = buildReport(generatedAt, entries, buckets);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, report, "utf8");

  logger.info(
    {
      outPath,
      totalMatches: entries.length,
      fileCount: files.length,
    },
    "supabase_fallback_audit_generated",
  );

  process.stdout.write(`Supabase fallback audit generated: ${outPath}\n`);
}

main().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "supabase_fallback_audit_failed",
  );
  process.exit(1);
});
