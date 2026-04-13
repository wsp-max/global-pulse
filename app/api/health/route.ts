import { NextResponse } from "next/server";
import { checkPostgresHealth } from "@global-pulse/shared/postgres";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";

export const dynamic = "force-dynamic";

interface DatabaseHealth {
  ok: boolean;
  provider: "postgres";
  latencyMs: number;
  error?: string;
}

async function checkDatabase(): Promise<DatabaseHealth> {
  const startedAt = Date.now();
  const postgresPool = getPostgresPoolOrNull();
  if (postgresPool) {
    const health = await checkPostgresHealth();
    return {
      ok: health.ok,
      provider: "postgres",
      latencyMs: health.latencyMs,
      error: health.error,
    };
  }

  return {
    ok: false,
    provider: "postgres",
    latencyMs: Date.now() - startedAt,
    error: "postgres_not_configured",
  };
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/health", async () => {
    const database = await checkDatabase();
    const ok = database.ok;
    const provider = database.provider;

    return NextResponse.json(
      {
        status: ok ? "ok" : "degraded",
        service: "global-pulse",
        timestamp: new Date().toISOString(),
        uptimeSec: Math.floor(process.uptime()),
        checks: {
          app: { ok: true },
          database,
        },
        migration: {
          target: "single-ec2-postgresql",
          phase: provider === "postgres" ? "postgres-runtime-active" : "infra-bootstrap",
        },
      },
      { status: ok ? 200 : 503 },
    );
  });
}
