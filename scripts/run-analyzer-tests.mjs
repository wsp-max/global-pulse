import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function collectTestFiles(rootDir) {
  const entries = readdirSync(rootDir);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(rootDir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".test.ts")) {
      files.push(resolve(fullPath));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

const testRoots = [resolve("packages/analyzer/test"), resolve("packages/collector/test")];
const testFiles = testRoots
  .filter((testRoot) => existsSync(testRoot))
  .flatMap((testRoot) => collectTestFiles(testRoot));

if (testFiles.length === 0) {
  console.log("No tests found. Skipping.");
  process.exit(0);
}

const result = spawnSync("node", ["--test", "--import", "tsx", ...testFiles], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
