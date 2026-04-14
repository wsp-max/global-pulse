import { spawn } from "node:child_process";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("ops-source-verify");

function resolveRunner(bin: string): string {
  if (process.platform === "win32") {
    return `${bin}.cmd`;
  }
  return bin;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function toBool(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) {
    return fallback;
  }

  switch (raw.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
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
      reject(new Error(`Source verify process failed with exit code ${code ?? -1}`));
    });
  });
}

async function main(): Promise<void> {
  const verifyEnabled = toBool(process.env.VERIFY_SOURCE_INGEST_ENABLED, true);
  if (!verifyEnabled) {
    logger.info("Source ingest verification disabled (VERIFY_SOURCE_INGEST_ENABLED=false).");
    return;
  }

  const cliArgs = process.argv.slice(2);
  const scriptPath = path.join("scripts", "verify-source-ingest.ts");
  const verifyArgs = ["tsx", scriptPath, ...cliArgs];

  if (!hasFlag(cliArgs, "--sources")) {
    verifyArgs.push("--sources", process.env.VERIFY_SOURCE_SOURCES ?? "bilibili,mastodon");
  }

  if (!hasFlag(cliArgs, "--minutes")) {
    verifyArgs.push(
      "--minutes",
      String(toPositiveInt(process.env.VERIFY_SOURCE_MINUTES, 180)),
    );
  }

  if (!hasFlag(cliArgs, "--samples")) {
    verifyArgs.push("--samples", String(toPositiveInt(process.env.VERIFY_SOURCE_SAMPLES, 3)));
  }

  if (
    !hasFlag(cliArgs, "--allow-empty") &&
    toBool(process.env.VERIFY_SOURCE_ALLOW_EMPTY, false)
  ) {
    verifyArgs.push("--allow-empty");
  }

  await runCommand(resolveRunner("npx"), verifyArgs);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
