import fs from "node:fs/promises";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:generate-evidence-report");

interface ParsedSummary {
  timestamp?: string;
  appDir?: string;
  sourceId?: string;
  runBackupRestore?: string;
  postgresConfigMode?: string;
  enableSupabaseFallback?: string;
  failures?: number;
  outputDir?: string;
  commands: Array<{
    name: string;
    status: "ok" | "fail";
    detail?: string;
  }>;
}

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((value) => value === flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveEvidenceDir(baseDir: string, explicitDir?: string): Promise<string> {
  if (explicitDir) {
    const absolute = path.resolve(explicitDir);
    if (!(await pathExists(absolute))) {
      throw new Error(`Evidence directory not found: ${absolute}`);
    }
    return absolute;
  }

  const root = path.resolve(baseDir, "docs", "evidence", "cutover");
  if (!(await pathExists(root))) {
    throw new Error(`Cutover evidence root not found: ${root}`);
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  for (const name of candidates) {
    const dir = path.join(root, name);
    if (await pathExists(path.join(dir, "summary.txt"))) {
      return dir;
    }
  }

  throw new Error(`No evidence bundle with summary.txt found under: ${root}`);
}

function parseSummaryText(content: string): ParsedSummary {
  const lines = content.split(/\r?\n/);
  const parsed: ParsedSummary = {
    commands: [],
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("timestamp=")) {
      parsed.timestamp = line.slice("timestamp=".length);
      continue;
    }
    if (line.startsWith("app_dir=")) {
      parsed.appDir = line.slice("app_dir=".length);
      continue;
    }
    if (line.startsWith("source_id=")) {
      parsed.sourceId = line.slice("source_id=".length);
      continue;
    }
    if (line.startsWith("run_backup_restore=")) {
      parsed.runBackupRestore = line.slice("run_backup_restore=".length);
      continue;
    }
    if (line.startsWith("postgres_config_mode=")) {
      parsed.postgresConfigMode = line.slice("postgres_config_mode=".length);
      continue;
    }
    if (line.startsWith("enable_supabase_fallback=")) {
      parsed.enableSupabaseFallback = line.slice("enable_supabase_fallback=".length);
      continue;
    }
    if (line.startsWith("failures=")) {
      const value = Number(line.slice("failures=".length));
      if (Number.isFinite(value)) {
        parsed.failures = value;
      }
      continue;
    }
    if (line.startsWith("output_dir=")) {
      parsed.outputDir = line.slice("output_dir=".length);
      continue;
    }

    const okMatch = line.match(/^\[OK\]\s+(.+)$/);
    if (okMatch) {
      parsed.commands.push({
        name: okMatch[1],
        status: "ok",
      });
      continue;
    }

    const failMatch = line.match(/^\[FAIL:(\d+)\]\s+(.+?)\s+\(see\s+(.+)\)$/);
    if (failMatch) {
      parsed.commands.push({
        name: failMatch[2],
        status: "fail",
        detail: `exit=${failMatch[1]}, log=${failMatch[3]}`,
      });
    }
  }

  return parsed;
}

function toMarkdownReport(evidenceDir: string, parsed: ParsedSummary): string {
  const nowIso = new Date().toISOString();
  const failureCount =
    typeof parsed.failures === "number"
      ? parsed.failures
      : parsed.commands.filter((item) => item.status === "fail").length;

  const lines: string[] = [];
  lines.push("# Cutover Evidence Report");
  lines.push("");
  lines.push(`- generated_at: ${nowIso}`);
  lines.push(`- evidence_dir: ${evidenceDir}`);
  if (parsed.timestamp) lines.push(`- evidence_timestamp: ${parsed.timestamp}`);
  if (parsed.appDir) lines.push(`- app_dir: ${parsed.appDir}`);
  if (parsed.sourceId) lines.push(`- source_id: ${parsed.sourceId}`);
  if (parsed.runBackupRestore) lines.push(`- run_backup_restore: ${parsed.runBackupRestore}`);
  if (parsed.postgresConfigMode) lines.push(`- postgres_config_mode: ${parsed.postgresConfigMode}`);
  if (parsed.enableSupabaseFallback) {
    lines.push(`- enable_supabase_fallback: ${parsed.enableSupabaseFallback}`);
  }
  lines.push(`- failures: ${failureCount}`);
  lines.push("");
  lines.push("## Command Results");
  if (parsed.commands.length === 0) {
    lines.push("- (no command results parsed from summary)");
  } else {
    for (const command of parsed.commands) {
      if (command.status === "ok") {
        lines.push(`- [OK] ${command.name}`);
      } else {
        lines.push(`- [FAIL] ${command.name}${command.detail ? ` (${command.detail})` : ""}`);
      }
    }
  }
  lines.push("");
  lines.push("## Patch Note Snippet");
  lines.push("```md");
  lines.push(`### EC2 Evidence Run (${parsed.timestamp ?? "unknown"})`);
  lines.push(`- failures: ${failureCount}`);
  lines.push(`- output: ${parsed.outputDir ?? evidenceDir}`);
  if (parsed.postgresConfigMode) {
    lines.push(`- postgres_config_mode: ${parsed.postgresConfigMode}`);
  }
  if (parsed.enableSupabaseFallback) {
    lines.push(`- enable_supabase_fallback: ${parsed.enableSupabaseFallback}`);
  }
  if (parsed.commands.length > 0) {
    lines.push("- key command outcomes:");
    for (const command of parsed.commands) {
      if (command.status === "ok") {
        lines.push(`  - ${command.name}: OK`);
      } else {
        lines.push(`  - ${command.name}: FAIL${command.detail ? ` (${command.detail})` : ""}`);
      }
    }
  }
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const explicitDir = parseArg("--dir");
  const outPathArg = parseArg("--out");

  const evidenceDir = await resolveEvidenceDir(repoRoot, explicitDir);
  const summaryPath = path.join(evidenceDir, "summary.txt");
  const summaryText = await fs.readFile(summaryPath, "utf8");
  const parsed = parseSummaryText(summaryText);
  const markdown = toMarkdownReport(evidenceDir, parsed);

  const outPath = outPathArg
    ? path.resolve(outPathArg)
    : path.join(evidenceDir, "REPORT.md");

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, markdown, "utf8");

  logger.info(
    {
      evidenceDir,
      outPath,
      failures:
        typeof parsed.failures === "number"
          ? parsed.failures
          : parsed.commands.filter((command) => command.status === "fail").length,
    },
    "evidence_report_generated",
  );

  if (hasFlag("--print")) {
    process.stdout.write(`${markdown}\n`);
  } else {
    process.stdout.write(`Report generated: ${outPath}\n`);
  }
}

main().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "evidence_report_generation_failed",
  );
  process.exit(1);
});
