import fs from "node:fs/promises";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:apply-final-verification-report");

interface FinalReportFields {
  verificationTimestamp?: string;
  closureState?: string;
  failures?: number;
  runDir?: string;
  rounds: string[];
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

async function resolveReportPath(root: string, reportArg?: string): Promise<string> {
  if (reportArg) {
    const resolved = path.resolve(reportArg);
    if (!(await pathExists(resolved))) {
      throw new Error(`Report file not found: ${resolved}`);
    }
    return resolved;
  }

  const finalRoot = path.resolve(root, "docs", "evidence", "final-verification");
  if (!(await pathExists(finalRoot))) {
    throw new Error(`Final verification evidence root not found: ${finalRoot}`);
  }

  const entries = await fs.readdir(finalRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  const orderedDirectories = [
    ...directories.filter((name) => PRODUCTION_DIR_PATTERN.test(name)),
    ...directories.filter((name) => !PRODUCTION_DIR_PATTERN.test(name)),
  ];

  for (const dirName of orderedDirectories) {
    const candidate = path.join(finalRoot, dirName, "FINAL_REPORT.md");
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No FINAL_REPORT.md found under: ${finalRoot}`);
}

function parseFinalReport(content: string): FinalReportFields {
  const lines = content.split(/\r?\n/);
  const fields: FinalReportFields = { rounds: [] };
  let inSnippet = false;
  let inRounds = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "```md") {
      inSnippet = true;
      continue;
    }
    if (trimmed === "```" && inSnippet) {
      inSnippet = false;
      inRounds = false;
      continue;
    }
    if (!inSnippet) {
      continue;
    }

    if (trimmed.startsWith("### Final Verification (") || trimmed.startsWith("### Final 3x Verification (")) {
      const match = trimmed.match(/^### Final(?: 3x)? Verification \((.+)\)$/);
      if (match) {
        fields.verificationTimestamp = match[1];
      }
      continue;
    }

    if (trimmed.startsWith("- closure_state:")) {
      fields.closureState = trimmed.replace("- closure_state:", "").trim();
      continue;
    }
    if (trimmed.startsWith("- failures:")) {
      const value = Number(trimmed.replace("- failures:", "").trim());
      if (Number.isFinite(value)) {
        fields.failures = value;
      }
      continue;
    }
    if (trimmed.startsWith("- run_dir:")) {
      fields.runDir = trimmed.replace("- run_dir:", "").trim();
      continue;
    }

    if (trimmed === "- rounds:") {
      inRounds = true;
      continue;
    }

    if (inRounds && trimmed.startsWith("- round")) {
      fields.rounds.push(trimmed.replace(/^- /, ""));
      continue;
    }
  }

  return fields;
}

function buildPatchNoteBlock(fields: FinalReportFields, reportPath: string): string {
  const timestamp = fields.verificationTimestamp ?? "unknown";
  const closureState = fields.closureState ?? "UNKNOWN";
  const failures = typeof fields.failures === "number" ? fields.failures : -1;
  const canonicalReportPath = getCanonicalReportPath(fields, reportPath);
  const lines: string[] = [];
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`## GP-FINAL-${timestamp} (EC2 Closure Evidence Imported)`);
  lines.push("### EC2 Final Verification Result");
  lines.push(`- Closure state: ${closureState}`);
  lines.push(`- Failures: ${failures}`);
  if (fields.runDir) {
    lines.push(`- Run directory: ${fields.runDir}`);
  }
  lines.push(`- Source report: ${canonicalReportPath}`);
  if (fields.rounds.length > 0) {
    lines.push("### Round Outcomes");
    for (const round of fields.rounds) {
      lines.push(`- ${round}`);
    }
  }
  lines.push("### Notes");
  lines.push("- Imported by `scripts/apply-final-verification-report.ts`.");
  return `${lines.join("\n")}\n`;
}

function buildDeliveryBlock(fields: FinalReportFields, reportPath: string): string {
  const timestamp = fields.verificationTimestamp ?? "unknown";
  const closureState = fields.closureState ?? "UNKNOWN";
  const failures = typeof fields.failures === "number" ? fields.failures : -1;
  const canonicalReportPath = getCanonicalReportPath(fields, reportPath);
  const lines: string[] = [];
  lines.push("");
  lines.push("## EC2 Pivot Progress Update (Closure Imported Final Evidence)");
  lines.push("### Imported Final Evidence");
  lines.push(`- Final verification timestamp: ${timestamp}`);
  lines.push(`- Closure state: ${closureState}`);
  lines.push(`- Failures: ${failures}`);
  lines.push(`- Evidence report: ${canonicalReportPath}`);
  if (fields.rounds.length > 0) {
    lines.push("- Round outcomes:");
    for (const round of fields.rounds) {
      lines.push(`  - ${round}`);
    }
  }
  if (closureState.toUpperCase() === "PASS" && failures === 0) {
    lines.push("");
    lines.push("### Remaining (current)");
    lines.push("1. Operational watch");
    lines.push("- Monitor timer-driven jobs and logs through at least one full day cycle.");
    lines.push("2. PostgreSQL-only guard maintenance");
    lines.push("- Keep `ops:supabase:audit` and `ops:supabase:budget` at 0 baseline.");
  } else {
    lines.push("");
    lines.push("### Remaining (current)");
    lines.push("1. Re-run final verification on EC2");
    lines.push("- Resolve failed rounds and regenerate `FINAL_REPORT.md`.");
    lines.push("2. Re-import updated evidence");
    lines.push("- Re-run this script with the new report.");
  }
  return `${lines.join("\n")}\n`;
}

function getCanonicalReportPath(fields: FinalReportFields, reportPath: string): string {
  if (fields.runDir) {
    const normalizedRunDir = fields.runDir.replace(/\\/g, "/").replace(/\/+$/, "");
    return `${normalizedRunDir}/FINAL_REPORT.md`;
  }
  return reportPath.replace(/\\/g, "/");
}

async function main(): Promise<void> {
  const root = process.cwd();
  const reportArg = parseArg("--report");
  const patchNotesPath = path.resolve(root, "docs", "PATCH_NOTES.md");
  const deliveryPath = path.resolve(root, "docs", "DELIVERY_STATUS.md");
  const reportPath = await resolveReportPath(root, reportArg);
  const reportText = await fs.readFile(reportPath, "utf8");
  const fields = parseFinalReport(reportText);

  if (!fields.closureState || typeof fields.failures !== "number") {
    throw new Error("Unable to parse closure_state/failures from FINAL_REPORT.md");
  }

  const patchBlock = buildPatchNoteBlock(fields, reportPath);
  const deliveryBlock = buildDeliveryBlock(fields, reportPath);
  const canonicalReportPath = getCanonicalReportPath(fields, reportPath);
  const sourceReportMarker = `- Source report: ${canonicalReportPath}`;

  if (hasFlag("--dry-run")) {
    process.stdout.write("=== PATCH_NOTES APPEND PREVIEW ===\n");
    process.stdout.write(patchBlock);
    process.stdout.write("\n=== DELIVERY_STATUS APPEND PREVIEW ===\n");
    process.stdout.write(deliveryBlock);
    return;
  }

  const force = hasFlag("--force");
  const [existingPatch, existingDelivery] = await Promise.all([
    fs.readFile(patchNotesPath, "utf8"),
    fs.readFile(deliveryPath, "utf8"),
  ]);

  if (
    !force &&
    (existingPatch.includes(sourceReportMarker) || existingDelivery.includes(canonicalReportPath))
  ) {
    process.stdout.write("Report appears to be already applied. Use --force to append again.\n");
    return;
  }

  await fs.appendFile(patchNotesPath, patchBlock, "utf8");
  await fs.appendFile(deliveryPath, deliveryBlock, "utf8");

  logger.info(
    {
      reportPath,
      patchNotesPath,
      deliveryPath,
      closureState: fields.closureState,
      failures: fields.failures,
    },
    "final_verification_report_applied",
  );

  process.stdout.write("Applied final verification report to docs/PATCH_NOTES.md and docs/DELIVERY_STATUS.md\n");
}

main().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "apply_final_verification_report_failed",
  );
  process.exit(1);
});
