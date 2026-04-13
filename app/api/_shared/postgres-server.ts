import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import type { Pool } from "pg";

let poolInstance: Pool | null = null;

export function getPostgresPoolOrNull(): Pool | null {
  if (!hasPostgresConfig()) {
    return null;
  }

  if (poolInstance) {
    return poolInstance;
  }

  try {
    poolInstance = createPostgresPool();
    return poolInstance;
  } catch {
    return null;
  }
}
