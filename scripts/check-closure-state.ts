import fs from "node:fs/promises";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:check-closure-state");

interface FinalSummary {
  timestamp?: string;
  failures?: number;
  runDir?: string;
}

interface FinalReport {
  timestamp?: string;
  closureState?: string;
  failures?: number;
  runDir?: string;
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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveFinalDir(root: string, explicitDir?: string): Promise<string> {
  if (explicitDir) {
    const resolved = path.resolve(explicitDir);
    if (!(await pathExists(resolved))) {
      throw new Error(`Final verification directory not found: ${resolved}`);
    }
    return resolved;
  }

  const finalRoot = path.resolve(root, "docs", "evidence", "final-verification");
  if (!(await pathExists(finalRoot))) {
    throw new Error(`Final verification root not found: ${finalRoot}`);
  }

  const entries = await fs.readdir(finalRoot, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  const orderedCandidates = [
    ...candidates.filter((name) => PRODUCTION_DIR_PATTERN.test(name)),
    ...candidates.filter((name) => !PRODUCTION_DIR_PATTERN.test(name)),
  ];

  for (const directory of orderedCandidates) {
    const candidateDir = path.join(finalRoot, directory);
    if (
      (await pathExists(path.join(candidateDir, "summary.txt"))) &&
      (await pathExists(path.join(candidateDir, "FINAL_REPORT.md")))
    ) {
      return candidateDir;
    }
  }

  throw new Error(`No valid final verification directory found under: ${finalRoot}`);
}

function parseSummary(content: string): FinalSummary {
  const lines = content.split(/\r?\n/);
  const result: FinalSummary = {};
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("timestamp=")) {
      result.timestamp = line.replace("timestamp=", "").trim();
      continue;
    }
    if (line.startsWith("failures=")) {
      const value = Number(line.replace("failures=", "").trim());
      if (Number.isFinite(value)) {
        result.failures = value;
      }
      continue;
    }
    if (line.startsWith("run_dir=")) {
      result.runDir = line.replace("run_dir=", "").trim();
    }
  }
  return result;
}

function parseFinalReport(content: string): FinalReport {
  const lines = content.split(/\r?\n/);
  const report: FinalReport = {};
  let inSnippet = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "```md") {
      inSnippet = true;
      continue;
    }
    if (line === "```" && inSnippet) {
      inSnippet = false;
      continue;
    }
    if (!inSnippet) continue;

    const timestampMatch = line.match(/^### Final(?: 3x)? Verification \((.+)\)$/);
    if (timestampMatch) {
      report.timestamp = timestampMatch[1];
      continue;
    }
    if (line.startsWith("- closure_state:")) {
      report.closureState = line.replace("- closure_state:", "").trim();
      continue;
    }
    if (line.startsWith("- failures:")) {
      const value = Number(line.replace("- failures:", "").trim());
      if (Number.isFinite(value)) {
        report.failures = value;
      }
      continue;
    }
    if (line.startsWith("- run_dir:")) {
      report.runDir = line.replace("- run_dir:", "").trim();
    }
  }

  return report;
}

function buildReportPathMarkers(reportPath: string, report: FinalReport, summary: FinalSummary): string[] {
  const markers = new Set<string>();
  markers.add(reportPath);
  markers.add(reportPath.replace(/\\/g, "/"));

  const runDir = report.runDir ?? summary.runDir;
  if (runDir) {
    const normalizedRunDir = runDir.replace(/\\/g, "/").replace(/\/+$/, "");
    markers.add(`${normalizedRunDir}/FINAL_REPORT.md`);
  }

  return Array.from(markers);
}

async function main(): Promise<void> {
  const root = process.cwd();
  const dirArg = parseArg("--dir");
  const skipDocs = hasFlag("--skip-docs");
  const printJson = hasFlag("--print-json");
  const expectedState = (parseArg("--expected-state") ?? "PASS").toUpperCase();
  const expectedFailures = Number(parseArg("--expected-failures") ?? "0");

  const finalDir = await resolveFinalDir(root, dirArg);
  const summaryPath = path.join(finalDir, "summary.txt");
  const reportPath = path.join(finalDir, "FINAL_REPORT.md");
  const [summaryText, reportText] = await Promise.all([
    fs.readFile(summaryPath, "utf8"),
    fs.readFile(reportPath, "utf8"),
  ]);

  const summary = parseSummary(summaryText);
  const report = parseFinalReport(reportText);
  const issues: string[] = [];

  if (typeof summary.failures !== "number") {
    issues.push("summary.failures is missing");
  }
  if (typeof report.failures !== "number") {
    issues.push("report.failures is missing");
  }
  if (!report.closureState) {
    issues.push("report.closureState is missing");
  }

  if (
    typeof summary.failures === "number" &&
    typeof report.failures === "number" &&
    summary.failures !== report.failures
  ) {
    issues.push(`mismatch failures: summary=${summary.failures}, report=${report.failures}`);
  }

  if (typeof report.failures === "number" && report.failures !== expectedFailures) {
    issues.push(`report.failures expected ${expectedFailures} but got ${report.failures}`);
  }

  if (report.closureState && report.closureState.toUpperCase() !== expectedState) {
    issues.push(`report.closureState expected ${expectedState} but got ${report.closureState}`);
  }

  if (!skipDocs) {
    const patchPath = path.resolve(root, "docs", "PATCH_NOTES.md");
    const deliveryPath = path.resolve(root, "docs", "DELIVERY_STATUS.md");
    const [patchText, deliveryText] = await Promise.all([
      fs.readFile(patchPath, "utf8"),
      fs.readFile(deliveryPath, "utf8"),
    ]);

    const reportPathMarkers = buildReportPathMarkers(reportPath, report, summary);
    const patchHasMarker = reportPathMarkers.some((marker) => patchText.includes(marker));
    const deliveryHasMarker = reportPathMarkers.some((marker) => deliveryText.includes(marker));

    if (!patchHasMarker) {
      issues.push("PATCH_NOTES.md does not include FINAL_REPORT path marker");
    }
    if (!deliveryHasMarker) {
      issues.push("DELIVERY_STATUS.md does not include FINAL_REPORT path marker");
    }
  }

  const payload = {
    finalDir,
    summaryPath,
    reportPath,
    summary,
    report,
    expected: {
      state: expectedState,
      failures: expectedFailures,
    },
    issues,
  };

  if (printJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    logger.info(payload, "closure_state_check");
    process.stdout.write(`Closure check: ${issues.length === 0 ? "PASS" : "FAIL"} (${finalDir})\n`);
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
    "check_closure_state_failed",
  );
  process.exit(1);
});
