import type { Pool } from "pg";
import type { RegionSourceHealthSummary, SourceHealthStatus, SourceHealthSummary } from "@/lib/types/api";

type SourceType = "community" | "sns" | "news";
type CollectorRunStatus = "success" | "failed";

interface SourceHealthDbRow {
  id: string;
  region_id: string;
  name: string;
  type: SourceType;
  is_active: boolean;
  last_error: string | null;
  last_scraped_at: string | null;
  recent_count: number | string | null;
  total_runs_24h: number | string | null;
  success_runs_24h: number | string | null;
  p95_latency_ms_24h: number | string | null;
  latest_run_status: CollectorRunStatus | null;
  latest_run_started_at: string | null;
  latest_run_finished_at: string | null;
  latest_error_code: string | null;
  latest_error_message: string | null;
  latest_success_at: string | null;
}

export interface SourceHealthRecord {
  id: string;
  regionId: string;
  name: string;
  type: SourceType;
  isActive: boolean;
  isOptional: boolean;
  status: SourceHealthStatus;
  recentCount24h: number;
  totalRuns24h: number;
  successRuns24h: number;
  successRate24h: number;
  p95LatencyMs24h: number | null;
  lastScrapedAt: string | null;
  lastError: string | null;
  latestRunStatus: CollectorRunStatus | null;
  latestRunStartedAt: string | null;
  latestRunFinishedAt: string | null;
  latestSuccessAt: string | null;
  recentErrorCode: string | null;
  recentErrorMessage: string | null;
  isDegraded: boolean;
  isAutoDisabled: boolean;
}

export interface SourceErrorGroup {
  errorCode: string;
  count: number;
  sources: Array<{
    id: string;
    name: string;
    regionId: string;
    status: SourceHealthStatus;
  }>;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function toRoundedPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(((numerator / denominator) * 100).toFixed(1))));
}

function isAutoDisabledMarker(value: string | null): boolean {
  return Boolean(value && value.startsWith("auto_disabled_consecutive_failures"));
}

export function isRedditSourceId(sourceId: string): boolean {
  return sourceId.trim().toLowerCase().startsWith("reddit_");
}

export function isOptionalSourceId(sourceId: string): boolean {
  return isRedditSourceId(sourceId);
}

export function normalizeSourceErrorCode(
  error: string | null | undefined,
  sourceId: string,
): string | null {
  if (!error) {
    return null;
  }
  const normalized = error.trim().toLowerCase();
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
    if (isRedditSourceId(sourceId) && (code === "403" || code === "429")) {
      return "reddit_blocked";
    }
    return `http_${code}`;
  }

  if (
    normalized.includes("request failed with status code 403") ||
    normalized.includes("forbidden")
  ) {
    return isRedditSourceId(sourceId) ? "reddit_blocked" : "http_403";
  }
  if (
    normalized.includes("request failed with status code 429") ||
    normalized.includes("too many requests")
  ) {
    return isRedditSourceId(sourceId) ? "reddit_blocked" : "http_429";
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
    isRedditSourceId(sourceId) &&
    (normalized.includes("reddit listing failure") ||
      normalized.includes("listing failure") ||
      normalized.includes("reddit blocked"))
  ) {
    return "reddit_blocked";
  }

  const token = normalized.split(/[\s:|]+/, 1)[0] ?? "";
  return token.slice(0, 40) || null;
}

function classifySourceStatus(input: {
  isActive: boolean;
  isOptional: boolean;
  isAutoDisabled: boolean;
  latestRunStatus: CollectorRunStatus | null;
  recentCount24h: number;
  totalRuns24h: number;
  successRate24h: number;
  recentErrorCode: string | null;
}): SourceHealthStatus {
  const {
    isActive,
    isOptional,
    isAutoDisabled,
    latestRunStatus,
    recentCount24h,
    totalRuns24h,
    successRate24h,
    recentErrorCode,
  } = input;

  if (isOptional) {
    const blockedByCode = recentErrorCode === "reddit_blocked" || recentErrorCode === "http_403" || recentErrorCode === "http_429";
    if (!isActive && isAutoDisabled) {
      return "optional_blocked";
    }
    if (blockedByCode) {
      return "optional_blocked";
    }
    if (latestRunStatus === "failed") {
      return "optional_degraded";
    }
    if (totalRuns24h > 0 && successRate24h < 70) {
      return "optional_degraded";
    }
    if (latestRunStatus === "success" && recentCount24h > 0) {
      return "optional_healthy";
    }
    if (latestRunStatus === "success" && recentCount24h === 0) {
      return "optional_stale";
    }
    if (recentCount24h > 0) {
      return "optional_healthy";
    }
    return "optional_degraded";
  }

  if (!isActive) {
    return isAutoDisabled ? "auto_disabled" : "disabled";
  }
  if (latestRunStatus === "failed") {
    return "degraded";
  }
  if (totalRuns24h > 0 && successRate24h < 70) {
    return "degraded";
  }
  if (latestRunStatus === "success" && recentCount24h > 0) {
    return "healthy";
  }
  if (latestRunStatus === "success" && recentCount24h === 0) {
    return "stale";
  }
  if (recentCount24h > 0) {
    return "healthy";
  }
  return "stale";
}

function toSourceHealthRecord(row: SourceHealthDbRow): SourceHealthRecord {
  const recentCount24h = toNumber(row.recent_count);
  const totalRuns24h = toNumber(row.total_runs_24h);
  const successRuns24h = toNumber(row.success_runs_24h);
  const successRate24h = toRoundedPercent(successRuns24h, totalRuns24h);
  const latency = row.p95_latency_ms_24h === null ? null : toNumber(row.p95_latency_ms_24h);
  const p95LatencyMs24h = latency !== null && latency > 0 ? Math.round(latency) : null;
  const isOptional = isOptionalSourceId(row.id);
  const isAutoDisabled = isAutoDisabledMarker(row.last_error);
  const rawError = row.latest_error_code ?? row.latest_error_message ?? row.last_error;
  const recentErrorCode = normalizeSourceErrorCode(rawError, row.id);
  const recentErrorMessage = row.latest_error_message ?? row.last_error;
  const status = classifySourceStatus({
    isActive: row.is_active,
    isOptional,
    isAutoDisabled,
    latestRunStatus: row.latest_run_status,
    recentCount24h,
    totalRuns24h,
    successRate24h,
    recentErrorCode,
  });
  const isDegraded = status === "degraded" || status === "optional_degraded" || status === "optional_blocked";

  return {
    id: row.id,
    regionId: row.region_id,
    name: row.name,
    type: row.type,
    isActive: row.is_active,
    isOptional,
    status,
    recentCount24h,
    totalRuns24h,
    successRuns24h,
    successRate24h,
    p95LatencyMs24h,
    lastScrapedAt: row.last_scraped_at,
    lastError: row.last_error,
    latestRunStatus: row.latest_run_status,
    latestRunStartedAt: row.latest_run_started_at,
    latestRunFinishedAt: row.latest_run_finished_at,
    latestSuccessAt: row.latest_success_at,
    recentErrorCode,
    recentErrorMessage,
    isDegraded,
    isAutoDisabled,
  };
}

export async function fetchSourceHealthRecords(pool: Pool): Promise<SourceHealthRecord[]> {
  const { rows } = await pool.query<SourceHealthDbRow>(
    `
    with recent_posts as (
      select source_id, count(*) as recent_count
      from raw_posts
      where collected_at >= now() - interval '24 hours'
      group by source_id
    ),
    run_stats as (
      select
        source_id,
        count(*) as total_runs_24h,
        count(*) filter (where status = 'success') as success_runs_24h,
        percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms_24h
      from collector_runs
      where started_at >= now() - interval '24 hours'
      group by source_id
    ),
    latest_run as (
      select distinct on (source_id)
        source_id,
        status as latest_run_status,
        started_at as latest_run_started_at,
        finished_at as latest_run_finished_at,
        error_code as latest_error_code,
        error_message as latest_error_message
      from collector_runs
      order by source_id, coalesce(finished_at, started_at) desc
    ),
    latest_success as (
      select
        source_id,
        max(finished_at) as latest_success_at
      from collector_runs
      where status = 'success'
      group by source_id
    )
    select
      s.id,
      s.region_id,
      s.name,
      s.type,
      s.is_active,
      s.last_error,
      s.last_scraped_at,
      coalesce(rp.recent_count, 0) as recent_count,
      coalesce(rs.total_runs_24h, 0) as total_runs_24h,
      coalesce(rs.success_runs_24h, 0) as success_runs_24h,
      rs.p95_latency_ms_24h,
      lr.latest_run_status,
      lr.latest_run_started_at,
      lr.latest_run_finished_at,
      lr.latest_error_code,
      lr.latest_error_message,
      ls.latest_success_at
    from sources s
    left join recent_posts rp on rp.source_id = s.id
    left join run_stats rs on rs.source_id = s.id
    left join latest_run lr on lr.source_id = s.id
    left join latest_success ls on ls.source_id = s.id
    order by s.region_id asc, s.id asc
    `,
  );

  return rows.map(toSourceHealthRecord);
}

export function summarizeSourceHealth(records: SourceHealthRecord[]): SourceHealthSummary {
  const coreRecords = records.filter((record) => !record.isOptional);
  const optionalRecords = records.filter((record) => record.isOptional);
  const activeCore = coreRecords.filter((record) => record.isActive);
  const collectedSources24h = activeCore.filter((record) => record.recentCount24h > 0).length;
  const healthySources = activeCore.filter((record) => record.status === "healthy").length;
  const staleSources = activeCore.filter((record) => record.status === "stale").length;
  const degradedActiveSources = activeCore.filter((record) => record.status === "degraded").length;
  const autoDisabledSources = coreRecords.filter((record) => record.status === "auto_disabled").length;
  const disabledSources = coreRecords.filter(
    (record) => record.status === "disabled" || record.status === "auto_disabled",
  ).length;
  const optionalHealthySources = optionalRecords.filter(
    (record) => record.status === "optional_healthy",
  ).length;
  const optionalBlockedSources = optionalRecords.filter(
    (record) => record.status === "optional_blocked",
  ).length;

  return {
    totalSources: records.length,
    activeSources: activeCore.length,
    collectedSources24h,
    collectionCoveragePct: toRoundedPercent(collectedSources24h, activeCore.length),
    degradedActiveSources,
    disabledSources,
    autoDisabledSources,
    healthySources,
    staleSources,
    optionalSources: optionalRecords.length,
    optionalHealthySources,
    optionalBlockedSources,
    recoveryNeededSources: degradedActiveSources + staleSources + autoDisabledSources,
  };
}

export function summarizeRegionSourceHealth(
  regionId: string,
  records: SourceHealthRecord[],
  topicSourceIds: Iterable<string>,
): RegionSourceHealthSummary {
  const coreRecords = records.filter((record) => !record.isOptional);
  const optionalRecords = records.filter((record) => record.isOptional);
  const activeCore = coreRecords.filter((record) => record.isActive);
  const activeCoreIds = new Set(activeCore.map((record) => record.id));
  const topicSourceIdSet = new Set<string>();
  for (const sourceId of topicSourceIds) {
    if (activeCoreIds.has(sourceId)) {
      topicSourceIdSet.add(sourceId);
    }
  }

  const collectedSources24h = activeCore.filter((record) => record.recentCount24h > 0).length;
  const degradedActiveSources = activeCore.filter((record) => record.status === "degraded").length;
  const autoDisabledSources = coreRecords.filter((record) => record.status === "auto_disabled").length;
  const disabledSources = coreRecords.filter(
    (record) => record.status === "disabled" || record.status === "auto_disabled",
  ).length;
  const optionalHealthySources = optionalRecords.filter(
    (record) => record.status === "optional_healthy",
  ).length;
  const optionalBlockedSources = optionalRecords.filter(
    (record) => record.status === "optional_blocked",
  ).length;

  return {
    regionId,
    activeSources: activeCore.length,
    collectedSources24h,
    topicSources: topicSourceIdSet.size,
    collectionCoveragePct: toRoundedPercent(collectedSources24h, activeCore.length),
    topicCoveragePct: toRoundedPercent(topicSourceIdSet.size, activeCore.length),
    degradedActiveSources,
    disabledSources,
    autoDisabledSources,
    optionalSources: optionalRecords.length,
    optionalHealthySources,
    optionalBlockedSources,
  };
}

export function buildSourceErrorGroups(records: SourceHealthRecord[]): SourceErrorGroup[] {
  const groups = new Map<string, SourceErrorGroup>();
  const targetRows = records.filter(
    (record) =>
      record.status === "degraded" ||
      record.status === "optional_degraded" ||
      record.status === "optional_blocked",
  );

  for (const row of targetRows) {
    const errorCode =
      row.recentErrorCode ??
      (row.recentCount24h < 1 ? "no_data_24h" : "unknown");
    const existing = groups.get(errorCode);
    if (!existing) {
      groups.set(errorCode, {
        errorCode,
        count: 1,
        sources: [{ id: row.id, name: row.name, regionId: row.regionId, status: row.status }],
      });
      continue;
    }
    existing.count += 1;
    if (existing.sources.length < 8) {
      existing.sources.push({ id: row.id, name: row.name, regionId: row.regionId, status: row.status });
    }
  }

  return [...groups.values()].sort((left, right) => right.count - left.count);
}
