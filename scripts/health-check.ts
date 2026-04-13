import { getLogger } from "@global-pulse/shared/server-logger";

const DEFAULT_URL = process.env.HEALTH_URL ?? "http://127.0.0.1:3000/api/health";
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.HEALTH_TIMEOUT_MS ?? "4000", 10);
const ALLOW_DEGRADED = process.env.HEALTH_ALLOW_DEGRADED !== "0";
const logger = getLogger("health-check");

interface HealthResponse {
  status?: string;
  checks?: {
    database?: {
      ok?: boolean;
      error?: string;
    };
  };
}

async function main(): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(DEFAULT_URL, {
      method: "GET",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    const payload = (await response.json()) as HealthResponse;
    const status = payload.status ?? "unknown";

    logger.info(`endpoint=${DEFAULT_URL} status=${status} http=${response.status}`);

    if (response.status !== 200 && response.status !== 503) {
      throw new Error(`Unexpected HTTP status from health endpoint: ${response.status}`);
    }

    if (status !== "ok" && status !== "degraded") {
      throw new Error(`Unexpected health status: ${status}`);
    }

    if (status === "degraded" && !ALLOW_DEGRADED) {
      throw new Error("Health endpoint returned degraded state and HEALTH_ALLOW_DEGRADED=0.");
    }

    const dbOk = payload.checks?.database?.ok;
    if (dbOk === false) {
      const dbError = payload.checks?.database?.error ?? "unknown";
      logger.warn(`database check failed: ${dbError}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
});
