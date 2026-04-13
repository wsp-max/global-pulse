import { Pool, type PoolConfig } from "pg";

let sharedPool: Pool | null = null;

export function hasPostgresConfig(): boolean {
  if (process.env.DATABASE_URL) {
    return true;
  }

  return Boolean(
    process.env.DB_HOST &&
      process.env.DB_PORT &&
      process.env.DB_NAME &&
      process.env.DB_USER &&
      process.env.DB_PASSWORD,
  );
}

function getPoolConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: Number.parseInt(process.env.DB_POOL_MAX ?? "10", 10),
      idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? "30000", 10),
      connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS ?? "5000", 10),
    };
  }

  const host = process.env.DB_HOST;
  const port = Number.parseInt(process.env.DB_PORT ?? "5432", 10);
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      "PostgreSQL is not configured. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.",
    );
  }

  return {
    host,
    port,
    database,
    user,
    password,
    max: Number.parseInt(process.env.DB_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? "30000", 10),
    connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS ?? "5000", 10),
  };
}

export function createPostgresPool(): Pool {
  if (sharedPool) {
    return sharedPool;
  }

  const config = getPoolConfig();
  sharedPool = new Pool(config);
  return sharedPool;
}

export async function checkPostgresHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startedAt = Date.now();
  if (!hasPostgresConfig()) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: "not_configured",
    };
  }

  try {
    const pool = createPostgresPool();
    await pool.query("select 1");
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
