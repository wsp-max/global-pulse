import { spawn } from "node:child_process";
import path from "node:path";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("ops-collector");

function resolveRunner(bin: string): string {
  if (process.platform === "win32") {
    return `${bin}.cmd`;
  }
  return bin;
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
      reject(new Error(`Collector process failed with exit code ${code ?? -1}`));
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const entry = path.join("packages", "collector", "src", "run.ts");
  await runCommand(resolveRunner("npx"), ["tsx", entry, ...args]);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
