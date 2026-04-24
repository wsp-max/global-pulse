import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import type { Pool } from "pg";
import { Logger } from "./logger";
import { isOptionalSourceId } from "./source-scaling";

export type CollectorRunStatus = "success" | "failed";

export interface CollectorRunInput {
  sourceId: string;
  startedAt: string;
  finishedAt: string;
  status: CollectorRunStatus;
  fetchedCount: number;
  insertedCount: number;
  latencyMs: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface CollectorRunOutcome {
  recorded: boolean;
  autoDisabled: boolean;
}

let postgresPool: Pool | null = null;
let postgresDisabled = false;

function getPostgresPoolOrNull(): Pool | null {
  if (postgresDisabled) {
    return null;
  }
  if (!hasPostgresConfig()) {
    return null;
  }
  try {
    if (!postgresPool) {
      postgresPool = createPostgresPool();
    }
    return postgresPool;
  } catch (error) {
    postgresDisabled = true;
    Logger.warn(
      `collector_runs persistence disabled: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

export function toCollectorRunErrorCode(value: string | null | undefined, sourceId?: string): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.includes("auto_disabled_consecutive_failures")) {
    return "auto_disabled_consecutive_failures";
  }

  const statusMatch =
    normalized.match(/status code\s*(\d{3})/i) ??
    normalized.match(/\bhttp[_\s-]?(\d{3})\b/i);
  if (statusMatch?.[1]) {
    const code = statusMatch[1];
    if (sourceId && isOptionalSourceId(sourceId) && (code === "403" || code === "429")) {
      return "reddit_blocked";
    }
    if (code === "403") return "http_403";
    if (code === "429") return "http_429";
    return `http_${code}`;
  }

  if (
    normalized.includes("no rss items parsed") ||
    normalized.includes("no ranking entries parsed") ||
    normalized.includes("no ranking entry parsed")
  ) {
    return "no_items_parsed";
  }
  if (normalized.includes("timeout after") || normalized.includes("timed out")) {
    return "timeout";
  }
  if (
    normalized.includes("robots disallow") ||
    normalized.includes("robots.txt disallow") ||
    (normalized.includes("robots") && normalized.includes("disallow"))
  ) {
    return "robots_disallow";
  }
  if (
    sourceId &&
    isOptionalSourceId(sourceId) &&
    (normalized.includes("reddit listing failure") ||
      normalized.includes("listing failure") ||
      normalized.includes("forbidden") ||
      normalized.includes("too many requests"))
  ) {
    return "reddit_blocked";
  }

  const token = normalized.split(/[\s:|]+/, 1)[0] ?? "";
  return token.slice(0, 40) || null;
}

function isAutoDisabledMarker(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return value.startsWith("auto_disabled_consecutive_failures");
}

async function autoDisableOnConsecutiveFailures(pool: Pool, sourceId: string): Promise<boolean> {
  if (isOptionalSourceId(sourceId)) {
    return false;
  }

  const recentRuns = await pool.query<{ status: string }>(
    `
    select status
    from collector_runs
    where source_id = $1
    order by started_at desc
    limit 3
    `,
    [sourceId],
  );

  if (recentRuns.rows.length < 3) {
    return false;
  }

  const allFailed = recentRuns.rows.every((row) => row.status !== "success");
  if (!allFailed) {
    return false;
  }

  const sourceState = await pool.query<{ is_active: boolean; last_error: string | null }>(
    `
    select is_active, last_error
    from sources
    where id = $1
    limit 1
    `,
    [sourceId],
  );

  const state = sourceState.rows[0];
  if (!state) {
    return false;
  }

  if (!state.is_active && isAutoDisabledMarker(state.last_error)) {
    return false;
  }

  const timestamp = new Date().toISOString();
  const marker = `auto_disabled_consecutive_failures@${timestamp}`;
  const updateResult = await pool.query(
    `
    update sources
    set
      is_active = false,
      last_error = $2
    where id = $1
    `,
    [sourceId, marker],
  );

  if ((updateResult.rowCount ?? 0) > 0) {
    Logger.warn(`[${sourceId}] auto-disabled after 3 consecutive failed collector runs`);
    return true;
  }

  return false;
}

export async function recordCollectorRun(input: CollectorRunInput): Promise<CollectorRunOutcome> {
  const postgres = getPostgresPoolOrNull();
  if (!postgres) {
    return {
      recorded: false,
      autoDisabled: false,
    };
  }

  try {
    await postgres.query(
      `
      insert into collector_runs (
        source_id,
        started_at,
        finished_at,
        status,
        fetched_count,
        inserted_count,
        error_code,
        error_message,
        latency_ms
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        input.sourceId,
        input.startedAt,
        input.finishedAt,
        input.status,
        input.fetchedCount,
        input.insertedCount,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.latencyMs,
      ],
    );

    const autoDisabled = input.status === "failed"
      ? await autoDisableOnConsecutiveFailures(postgres, input.sourceId)
      : false;

    return {
      recorded: true,
      autoDisabled,
    };
  } catch (error) {
    Logger.error(
      `[${input.sourceId}] collector_runs insert failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      recorded: false,
      autoDisabled: false,
    };
  }
}
