import fs from "node:fs/promises";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:check-supabase-fallback-budget");

type MatchType =
  | "createSupabaseServiceClient"
  | "getSupabaseServiceClientOrNull"
  | "ENABLE_SUPABASE_FALLBACK"
  | "SUPABASE_ENV";

interface BudgetFile {
  generatedAt: string;
  totalMatches: number;
  counts: Record<MatchType, number>;
}

interface CountResult {
  totalMatches: number;
  counts: Record<MatchType, number>;
}

const TARGET_DIRS = ["app", "packages", "scripts"];
const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
const EXCLUDED_RELATIVE_FILES = new Set([
  "scripts/audit-supabase-fallback.ts",
  "scripts/check-supabase-fallback-budget.ts",
]);

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

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
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await recurse(fullPath);
        continue;
      }
      if (entry.isFile() && TARGET_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(fullPath);
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
  if (
    line.includes("SUPABASE_URL") ||
    line.includes("SUPABASE_SERVICE_KEY") ||
    line.includes("SUPABASE_ANON_KEY")
  ) {
    matches.push("SUPABASE_ENV");
  }
  return matches;
}

function emptyCounts(): Record<MatchType, number> {
  return {
    createSupabaseServiceClient: 0,
    getSupabaseServiceClientOrNull: 0,
    ENABLE_SUPABASE_FALLBACK: 0,
    SUPABASE_ENV: 0,
  };
}

async function collectCounts(root: string): Promise<CountResult> {
  const files = (await Promise.all(TARGET_DIRS.map((directory) => walkFiles(root, directory)))).flat();
  const counts = emptyCounts();
  let total = 0;

  for (const filePath of files) {
    const relative = path.relative(root, filePath).replace(/\\/g, "/");
    if (EXCLUDED_RELATIVE_FILES.has(relative)) {
      continue;
    }
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const matches = matchLine(line);
      for (const match of matches) {
        counts[match] += 1;
        total += 1;
      }
    }
  }

  return {
    totalMatches: total,
    counts,
  };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const budgetPath = path.resolve(
    parseArg("--budget") ?? "docs/source-notes/supabase-fallback-budget.json",
  );
  const printJson = hasFlag("--print-json");

  const budgetRaw = await fs.readFile(budgetPath, "utf8");
  const budget = JSON.parse(budgetRaw) as BudgetFile;
  const current = await collectCounts(root);

  const issues: string[] = [];
  if (current.totalMatches > budget.totalMatches) {
    issues.push(
      `totalMatches increased: current=${current.totalMatches}, budget=${budget.totalMatches}`,
    );
  }

  const keys: MatchType[] = [
    "createSupabaseServiceClient",
    "getSupabaseServiceClientOrNull",
    "ENABLE_SUPABASE_FALLBACK",
    "SUPABASE_ENV",
  ];
  for (const key of keys) {
    if (current.counts[key] > budget.counts[key]) {
      issues.push(`${key} increased: current=${current.counts[key]}, budget=${budget.counts[key]}`);
    }
  }

  const payload = {
    budgetPath,
    budget,
    current,
    ok: issues.length === 0,
    issues,
  };

  if (printJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    logger.info(payload, "supabase_fallback_budget_check");
    process.stdout.write(`Supabase fallback budget: ${issues.length === 0 ? "PASS" : "FAIL"}\n`);
  }

  if (issues.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "supabase_fallback_budget_check_failed",
  );
  process.exit(1);
});
