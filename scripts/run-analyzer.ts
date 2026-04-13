import { spawn } from "node:child_process";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("ops-analyzer");

function resolveRunner(bin: string): string {
  if (process.platform === "win32") {
    return `${bin}.cmd`;
  }
  return bin;
}

function parseFlag(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function removeFlagWithValue(args: string[], flag: string): string[] {
  const index = args.findIndex((arg) => arg === flag);
  if (index < 0) {
    return args;
  }
  const result = [...args];
  result.splice(index, 2);
  return result;
}

function removeBooleanFlag(args: string[], flag: string): string[] {
  return args.filter((arg) => arg !== flag);
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
      reject(new Error(`Analyzer process failed with exit code ${code ?? -1}`));
    });
  });
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const withGlobal = hasFlag("--with-global") || process.env.GLOBAL_PULSE_ANALYZE_GLOBAL === "1";

  let analysisArgs = removeBooleanFlag(rawArgs, "--with-global");
  const globalHours = parseFlag("--global-hours");
  analysisArgs = removeFlagWithValue(analysisArgs, "--global-hours");

  const analysisEntry = path.join("packages", "analyzer", "src", "run-analysis.ts");
  await runCommand(resolveRunner("npx"), ["tsx", analysisEntry, ...analysisArgs]);

  if (!withGlobal) {
    return;
  }

  const globalEntry = path.join("packages", "analyzer", "src", "run-global-analysis.ts");
  const globalArgs = globalHours ? ["--hours", globalHours] : [];

  await runCommand(resolveRunner("npx"), ["tsx", globalEntry, ...globalArgs]);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
