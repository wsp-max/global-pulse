import fs from "node:fs/promises";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:generate-final-verification-report");

interface RoundResult {
  index: number;
  cutoverDir?: string;
  captureStatus?: number;
  reportStatus?: number;
  scriptFailures?: number;
}

interface ParsedFinalSummary {
  timestamp?: string;
  appDir?: string;
  rounds?: number;
  sleepSeconds?: number;
  sourceId?: string;
  failures?: number;
  runDir?: string;
  roundResults: RoundResult[];
}

const PRODUCTION_DIR_PATTERN = /^\d{8}_\d{6}$/;

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((value) => value === flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function toOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveFinalDir(baseDir: string, explicitDir?: string): Promise<string> {
  if (explicitDir) {
    const absolute = path.resolve(explicitDir);
    if (!(await pathExists(absolute))) {
      throw new Error(`Final verification directory not found: ${absolute}`);
    }
    return absolute;
  }

  const root = path.resolve(baseDir, "docs", "evidence", "final-verification");
  if (!(await pathExists(root))) {
    throw new Error(`Final verification root not found: ${root}`);
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  const orderedCandidates = [
    ...candidates.filter((name) => PRODUCTION_DIR_PATTERN.test(name)),
    ...candidates.filter((name) => !PRODUCTION_DIR_PATTERN.test(name)),
  ];

  for (const name of orderedCandidates) {
    const dir = path.join(root, name);
    if (await pathExists(path.join(dir, "summary.txt"))) {
      return dir;
    }
  }

  throw new Error(`No summary.txt found under: ${root}`);
}

function getOrCreateRound(results: RoundResult[], index: number): RoundResult {
  let existing = results.find((item) => item.index === index);
  if (!existing) {
    existing = { index };
    results.push(existing);
  }
  return existing;
}

function parseFinalSummary(content: string): ParsedFinalSummary {
  const lines = content.split(/\r?\n/);
  const parsed: ParsedFinalSummary = {
    roundResults: [],
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
    if (line.startsWith("rounds=")) {
      parsed.rounds = toOptionalNumber(line.slice("rounds=".length));
      continue;
    }
    if (line.startsWith("sleep_seconds=")) {
      parsed.sleepSeconds = toOptionalNumber(line.slice("sleep_seconds=".length));
      continue;
    }
    if (line.startsWith("source_id=")) {
      parsed.sourceId = line.slice("source_id=".length);
      continue;
    }
    if (line.startsWith("failures=")) {
      parsed.failures = toOptionalNumber(line.slice("failures=".length));
      continue;
    }
    if (line.startsWith("run_dir=")) {
      parsed.runDir = line.slice("run_dir=".length);
      continue;
    }

    const roundMatch = line.match(
      /^round(\d+)_(cutover_dir|capture_status|report_status|script_failures)=(.+)$/,
    );
    if (roundMatch) {
      const roundIndex = Number(roundMatch[1]);
      const key = roundMatch[2];
      const value = roundMatch[3];
      const round = getOrCreateRound(parsed.roundResults, roundIndex);

      if (key === "cutover_dir") {
        round.cutoverDir = value;
      } else if (key === "capture_status") {
        round.captureStatus = toOptionalNumber(value);
      } else if (key === "report_status") {
        round.reportStatus = toOptionalNumber(value);
      } else if (key === "script_failures") {
        round.scriptFailures = toOptionalNumber(value);
      }
    }
  }

  parsed.roundResults.sort((a, b) => a.index - b.index);
  return parsed;
}

function summarizeRoundStatus(round: RoundResult): "ok" | "fail" {
  if ((round.captureStatus ?? 0) !== 0) return "fail";
  if ((round.reportStatus ?? 0) !== 0) return "fail";
  if ((round.scriptFailures ?? 0) !== 0) return "fail";
  return "ok";
}

function toMarkdownReport(finalDir: string, parsed: ParsedFinalSummary): string {
  const generatedAt = new Date().toISOString();
  const totalFailures =
    parsed.failures ?? parsed.roundResults.filter((round) => summarizeRoundStatus(round) === "fail").length;
  const closureState = totalFailures === 0 ? "PASS" : "FAIL";

  const lines: string[] = [];
  lines.push("# Final Verification Report");
  lines.push("");
  lines.push(`- generated_at: ${generatedAt}`);
  lines.push(`- final_verification_dir: ${finalDir}`);
  if (parsed.timestamp) lines.push(`- verification_timestamp: ${parsed.timestamp}`);
  if (parsed.appDir) lines.push(`- app_dir: ${parsed.appDir}`);
  if (typeof parsed.rounds === "number") lines.push(`- rounds: ${parsed.rounds}`);
  if (typeof parsed.sleepSeconds === "number") lines.push(`- sleep_seconds: ${parsed.sleepSeconds}`);
  if (parsed.sourceId) lines.push(`- source_id: ${parsed.sourceId}`);
  lines.push(`- failures: ${totalFailures}`);
  lines.push(`- closure_state: ${closureState}`);
  lines.push("");
  lines.push("## Round Results");
  if (parsed.roundResults.length === 0) {
    lines.push("- (no round metadata found)");
  } else {
    for (const round of parsed.roundResults) {
      const status = summarizeRoundStatus(round);
      lines.push(
        `- round${round.index}: ${status.toUpperCase()} (capture=${round.captureStatus ?? "n/a"}, report=${round.reportStatus ?? "n/a"}, script_failures=${round.scriptFailures ?? "n/a"})`,
      );
      if (round.cutoverDir) {
        lines.push(`  cutover_dir=${round.cutoverDir}`);
      }
    }
  }
  lines.push("");
  lines.push("## Patch Note Snippet");
  lines.push("```md");
  lines.push(`### Final Verification (${parsed.timestamp ?? "unknown"})`);
  lines.push(`- closure_state: ${closureState}`);
  lines.push(`- failures: ${totalFailures}`);
  lines.push(`- run_dir: ${parsed.runDir ?? finalDir}`);
  if (parsed.roundResults.length > 0) {
    lines.push("- rounds:");
    for (const round of parsed.roundResults) {
      const status = summarizeRoundStatus(round).toUpperCase();
      lines.push(
        `  - round${round.index}: ${status} (capture=${round.captureStatus ?? "n/a"}, report=${round.reportStatus ?? "n/a"}, script_failures=${round.scriptFailures ?? "n/a"})`,
      );
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

  const finalDir = await resolveFinalDir(repoRoot, explicitDir);
  const summaryPath = path.join(finalDir, "summary.txt");
  const summaryText = await fs.readFile(summaryPath, "utf8");
  const parsed = parseFinalSummary(summaryText);
  const markdown = toMarkdownReport(finalDir, parsed);
  const outPath = outPathArg ? path.resolve(outPathArg) : path.join(finalDir, "FINAL_REPORT.md");

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, markdown, "utf8");

  logger.info(
    {
      finalDir,
      outPath,
      failures:
        parsed.failures ??
        parsed.roundResults.filter((round) => summarizeRoundStatus(round) === "fail").length,
    },
    "final_verification_report_generated",
  );

  if (hasFlag("--print")) {
    process.stdout.write(`${markdown}\n`);
  } else {
    process.stdout.write(`Final report generated: ${outPath}\n`);
  }
}

main().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "final_verification_report_generation_failed",
  );
  process.exit(1);
});
