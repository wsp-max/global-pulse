import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:closure-preflight");

interface PreflightResult {
  ok: boolean;
  issues: string[];
  warnings: string[];
  checks: {
    files: string[];
    docs: string[];
    commands: string[];
  };
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

function commandExists(command: string): boolean {
  const shell = process.platform === "win32" ? "powershell.exe" : "bash";
  const args =
    process.platform === "win32"
      ? ["-NoProfile", "-Command", `(Get-Command ${command} -ErrorAction SilentlyContinue) -ne $null`]
      : ["-lc", `command -v ${command} >/dev/null 2>&1`];
  const result = spawnSync(shell, args, { encoding: "utf8" });

  if (process.platform === "win32") {
    return result.stdout.trim().toLowerCase() === "true";
  }
  return result.status === 0;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const skipSystemd = hasFlag("--skip-systemd");
  const skipEnv = hasFlag("--skip-env");
  const printJson = hasFlag("--print-json");

  const requiredScripts = [
    "scripts/capture-cutover-evidence.sh",
    "scripts/run-final-verification-3x.sh",
    "scripts/generate-final-verification-report.ts",
    "scripts/apply-final-verification-report.ts",
    "scripts/check-closure-state.ts",
    "scripts/complete-closure.sh",
  ];

  const requiredDocs = [
    "docs/PATCH_NOTES.md",
    "docs/DELIVERY_STATUS.md",
    "docs/operations.md",
    "docs/supabase-cutover-checklist.md",
    "docs/deployment-ec2.md",
  ];

  const requiredCommands = ["npm", "bash", "curl"];
  const systemdCommands = ["systemctl", "journalctl", "pg_dump", "psql"];

  const issues: string[] = [];
  const warnings: string[] = [];
  const foundFiles: string[] = [];
  const foundDocs: string[] = [];
  const foundCommands: string[] = [];

  for (const relativeFile of requiredScripts) {
    const absolutePath = path.resolve(root, relativeFile);
    if (await pathExists(absolutePath)) {
      foundFiles.push(relativeFile);
    } else {
      issues.push(`missing script: ${relativeFile}`);
    }
  }

  for (const relativeDoc of requiredDocs) {
    const absolutePath = path.resolve(root, relativeDoc);
    if (await pathExists(absolutePath)) {
      foundDocs.push(relativeDoc);
    } else {
      issues.push(`missing doc: ${relativeDoc}`);
    }
  }

  for (const command of requiredCommands) {
    if (commandExists(command)) {
      foundCommands.push(command);
    } else {
      issues.push(`missing command: ${command}`);
    }
  }

  if (!skipSystemd) {
    if (process.platform !== "linux") {
      issues.push("systemd checks require Linux runtime; use --skip-systemd only for local preflight.");
    } else {
      for (const command of systemdCommands) {
        if (commandExists(command)) {
          foundCommands.push(command);
        } else {
          issues.push(`missing command: ${command}`);
        }
      }

      if (!(await pathExists("/run/systemd/system"))) {
        issues.push("/run/systemd/system not found (systemd runtime unavailable)");
      }
    }
  } else {
    warnings.push("systemd checks skipped");
  }

  if (!skipEnv) {
    const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
    const hasDiscretePostgresEnv = Boolean(
      process.env.DB_HOST &&
        process.env.DB_PORT &&
        process.env.DB_NAME &&
        process.env.DB_USER &&
        process.env.DB_PASSWORD,
    );

    if (!hasDatabaseUrl && !hasDiscretePostgresEnv) {
      warnings.push(
        "PostgreSQL env is not set. Configure DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.",
      );
    }
  } else {
    warnings.push("env checks skipped");
  }

  const result: PreflightResult = {
    ok: issues.length === 0,
    issues,
    warnings,
    checks: {
      files: foundFiles,
      docs: foundDocs,
      commands: [...new Set(foundCommands)],
    },
  };

  if (printJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    logger.info(result, "closure_preflight_result");
    process.stdout.write(`Closure preflight: ${result.ok ? "PASS" : "FAIL"}\n`);
    if (warnings.length > 0) {
      process.stdout.write(`Warnings: ${warnings.length}\n`);
    }
  }

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "closure_preflight_failed",
  );
  process.exit(1);
});
