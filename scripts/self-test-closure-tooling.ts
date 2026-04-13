import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:self-test-closure-tooling");

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function resolveRunner(bin: string): string {
  return process.platform === "win32" ? `${bin}.cmd` : bin;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(cwd: string, label: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const runner = resolveRunner("npx");
    const child = spawn(runner, args, {
      cwd,
      env: process.env,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) {
        logger.info({ label, args }, "self_test_step_pass");
        resolve();
        return;
      }

      const output = `${stdout}\n${stderr}`.slice(-4000);
      reject(new Error(`[${label}] failed (exit=${code ?? -1}):\n${output}`));
    });
  });
}

async function main(): Promise<void> {
  const root = process.cwd();
  const keepFixtures = hasFlag("--keep-fixtures");
  const stamp = `SELFTEST_${Date.now()}`;

  const cutoverDir = path.resolve(root, "docs", "evidence", "cutover", stamp);
  const finalDir = path.resolve(root, "docs", "evidence", "final-verification", stamp);

  await fs.mkdir(cutoverDir, { recursive: true });
  await fs.mkdir(finalDir, { recursive: true });

  const cutoverSummary = [
    "Global Pulse Cutover Evidence",
    `timestamp=${stamp}`,
    "app_dir=/srv/projects/project2/global-pulse",
    "source_id=reddit_worldnews",
    "run_backup_restore=0",
    "postgres_config_mode=database_url",
    "",
    "[RUN] db_init: npm run db:init",
    "[OK] db_init",
    "[RUN] verify_postgres: npm run verify:postgres -- --source reddit_worldnews",
    "[OK] verify_postgres",
    "",
    "failures=0",
    `output_dir=/srv/projects/project2/global-pulse/docs/evidence/cutover/${stamp}`,
    "",
  ].join("\n");

  const finalSummary = [
    "Global Pulse Final Verification",
    `timestamp=${stamp}`,
    "app_dir=/srv/projects/project2/global-pulse",
    "rounds=1",
    "sleep_seconds=0",
    "source_id=reddit_worldnews",
    "",
    `round1_cutover_dir=/srv/projects/project2/global-pulse/docs/evidence/cutover/${stamp}_1`,
    "round1_capture_status=0",
    "round1_report_status=0",
    "round1_script_failures=0",
    "",
    "failures=0",
    `run_dir=/srv/projects/project2/global-pulse/docs/evidence/final-verification/${stamp}`,
    "",
  ].join("\n");

  await Promise.all([
    fs.writeFile(path.join(cutoverDir, "summary.txt"), cutoverSummary, "utf8"),
    fs.writeFile(path.join(finalDir, "summary.txt"), finalSummary, "utf8"),
  ]);

  try {
    await runCommand(root, "generate_cutover_report", [
      "tsx",
      "scripts/generate-evidence-report.ts",
      "--dir",
      cutoverDir,
    ]);

    const cutoverReportPath = path.join(cutoverDir, "REPORT.md");
    if (!(await pathExists(cutoverReportPath))) {
      throw new Error(`Expected cutover report not found: ${cutoverReportPath}`);
    }

    await runCommand(root, "generate_final_report", [
      "tsx",
      "scripts/generate-final-verification-report.ts",
      "--dir",
      finalDir,
    ]);

    const finalReportPath = path.join(finalDir, "FINAL_REPORT.md");
    if (!(await pathExists(finalReportPath))) {
      throw new Error(`Expected final report not found: ${finalReportPath}`);
    }

    await runCommand(root, "apply_final_report_dry_run", [
      "tsx",
      "scripts/apply-final-verification-report.ts",
      "--report",
      finalReportPath,
      "--dry-run",
    ]);

    await runCommand(root, "check_closure_state", [
      "tsx",
      "scripts/check-closure-state.ts",
      "--dir",
      finalDir,
      "--skip-docs",
      "--expected-state",
      "PASS",
      "--expected-failures",
      "0",
    ]);

    await runCommand(root, "closure_preflight_local", [
      "tsx",
      "scripts/closure-preflight.ts",
      "--skip-systemd",
      "--skip-env",
    ]);

    logger.info({ stamp, cutoverDir, finalDir }, "self_test_completed");
    process.stdout.write(`Self-test completed: ${stamp}\n`);
  } finally {
    if (!keepFixtures) {
      await Promise.all([
        fs.rm(cutoverDir, { recursive: true, force: true }),
        fs.rm(finalDir, { recursive: true, force: true }),
      ]);
    }
  }
}

main().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "self_test_failed",
  );
  process.exit(1);
});
