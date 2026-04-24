import fs from "node:fs/promises";
import path from "node:path";
import { TOPIC_ALIASES } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import type { Pool } from "pg";

type ReportMode = "full" | "snap";
type Scope = "community" | "news";

type CollectionCounts24h = {
  rawPosts: number;
  topics: number;
  globalTopics: number;
  issueOverlaps: number;
};

type SourceHealthSummary = {
  healthySources: number;
  degradedSources: number;
  totalSources: number;
  autoDisabledSources24h: number;
  degradedTopCodes: Array<{ code: string; count: number }>;
  collectorRuns24h: {
    totalRuns: number;
    successRuns: number;
    successRate: number;
    p95LatencyMs: number | null;
  };
};

type RetentionRow = {
  table: string;
  rowCount: number;
  sizeBytes: number;
  oldestAt: string | null;
  newestAt: string | null;
};

type TopicRow = {
  nameEn: string;
  nameKo: string;
  firstSeenRegion: string | null;
  firstSeenAt: string | null;
  regions: string[];
  propagationEdges: Array<{ from: string; to: string; lagMinutes: number; confidence: number }>;
  spreadScore: number;
  velocityPerHour: number;
  acceleration: number;
  scope: Scope;
};

type PropagationTopRow = {
  canonicalKey: string;
  nameKo: string;
  nameEn: string;
  firstSeenRegion: string | null;
  firstSeenAt: string | null;
  regionCount: number;
  lagSummary: string;
  confidencePct: number;
  score: number;
  crossChecked: boolean;
};

const TELEGRAM_MAX_LENGTH = 4096;
const TELEGRAM_SAFE_LENGTH = 3900;
const REPORT_TABLES = [
  { table: "raw_posts", tsColumn: "collected_at" },
  { table: "topics", tsColumn: "created_at" },
  { table: "global_topics", tsColumn: "created_at" },
  { table: "region_snapshots", tsColumn: "snapshot_at" },
  { table: "collector_runs", tsColumn: "started_at" },
  { table: "issue_overlaps", tsColumn: "detected_at" },
  { table: "issue_overlap_events", tsColumn: "detected_at" },
] as const;

function parseReportMode(): ReportMode {
  const argMode = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--mode="))
    ?.split("=")[1]
    ?.trim()
    .toLowerCase();
  const raw = (argMode || process.env.REPORT_MODE || process.argv[2] || "full").trim().toLowerCase();
  return raw === "snap" ? "snap" : "full";
}

function nowIso() {
  return new Date().toISOString();
}

function since24hIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function formatCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return Math.round(value).toLocaleString("en-US");
}

function formatRatio(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatIsoKst(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
}

function formatIsoKstShort(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function formatTableSize(bytes: number | null | undefined) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "-";
  const gib = bytes / (1024 ** 3);
  if (gib >= 1) return `${gib.toFixed(2)} GiB`;
  const mib = bytes / (1024 ** 2);
  return `${mib.toFixed(1)} MiB`;
}

function normalizeErrorCode(lastError: string | null) {
  if (!lastError) return "unknown";
  const normalized = lastError.trim();
  if (!normalized) return "unknown";
  return (normalized.split(/[\s:|]+/, 1)[0] ?? "unknown").toLowerCase().slice(0, 40);
}

function normalizeTopicIdentity(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
}

function buildAliasLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [canonicalLabel, aliases] of Object.entries(TOPIC_ALIASES)) {
    const canonical = normalizeTopicIdentity(canonicalLabel);
    if (!canonical) continue;
    lookup.set(canonical, canonical);
    for (const alias of aliases) {
      const normalizedAlias = normalizeTopicIdentity(alias);
      if (!normalizedAlias) continue;
      lookup.set(normalizedAlias, canonical);
    }
  }
  return lookup;
}

const ALIAS_LOOKUP = buildAliasLookup();

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseTopicRows(rows: Array<Record<string, unknown>>): TopicRow[] {
  return rows.map((row) => {
    const regions = parseArray(row.regions).filter((item): item is string => typeof item === "string" && item.length > 0);
    const propagationEdges = parseArray(row.propagation_edges)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const edge = item as Record<string, unknown>;
        const from = typeof edge.from === "string" ? edge.from : "";
        const to = typeof edge.to === "string" ? edge.to : "";
        if (!from || !to) return null;
        return {
          from,
          to,
          lagMinutes: Math.max(0, Math.round(toNumber(edge.lagMinutes))),
          confidence: Math.max(0, Math.min(1, toNumber(edge.confidence))),
        };
      })
      .filter((item): item is { from: string; to: string; lagMinutes: number; confidence: number } => Boolean(item));

    return {
      nameEn: typeof row.name_en === "string" ? row.name_en : "",
      nameKo: typeof row.name_ko === "string" ? row.name_ko : "",
      firstSeenRegion: typeof row.first_seen_region === "string" ? row.first_seen_region : null,
      firstSeenAt: typeof row.first_seen_at === "string" ? row.first_seen_at : null,
      regions,
      propagationEdges,
      spreadScore: toNumber(row.spread_score),
      velocityPerHour: toNumber(row.velocity_per_hour),
      acceleration: toNumber(row.acceleration),
      scope: row.scope === "news" ? "news" : "community",
    };
  });
}

function topicCanonicalKey(topic: TopicRow): string {
  const normalizedEn = normalizeTopicIdentity(topic.nameEn);
  const normalizedKo = normalizeTopicIdentity(topic.nameKo);
  if (normalizedEn && ALIAS_LOOKUP.has(normalizedEn)) return ALIAS_LOOKUP.get(normalizedEn)!;
  if (normalizedKo && ALIAS_LOOKUP.has(normalizedKo)) return ALIAS_LOOKUP.get(normalizedKo)!;
  return normalizedEn || normalizedKo || "unknown";
}

async function loadCollectionCounts24h(pool: Pool): Promise<CollectionCounts24h> {
  const [rawPosts, topics, globalTopics, issueOverlaps] = await Promise.all([
    pool.query<{ count: string }>("select count(*)::text as count from raw_posts where collected_at >= now() - interval '24 hours'"),
    pool.query<{ count: string }>("select count(*)::text as count from topics where created_at >= now() - interval '24 hours'"),
    pool.query<{ count: string }>("select count(*)::text as count from global_topics where created_at >= now() - interval '24 hours'"),
    pool.query<{ count: string }>("select count(*)::text as count from issue_overlaps where detected_at >= now() - interval '24 hours'"),
  ]);

  return {
    rawPosts: toNumber(rawPosts.rows[0]?.count),
    topics: toNumber(topics.rows[0]?.count),
    globalTopics: toNumber(globalTopics.rows[0]?.count),
    issueOverlaps: toNumber(issueOverlaps.rows[0]?.count),
  };
}

async function loadSourceHealthSummary(pool: Pool): Promise<SourceHealthSummary> {
  const [sourceRowsResult, collectorRunsResult] = await Promise.all([
    pool.query<{
      id: string;
      last_error: string | null;
      recent_count: number | string | null;
      total_runs_24h: number | string | null;
      success_runs_24h: number | string | null;
      recent_error_code: string | null;
      recent_error_message: string | null;
    }>(
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
          count(*) filter (where status = 'success') as success_runs_24h
        from collector_runs
        where started_at >= now() - interval '24 hours'
        group by source_id
      ),
      latest_failure as (
        select distinct on (source_id)
          source_id,
          error_code as recent_error_code,
          error_message as recent_error_message
        from collector_runs
        where started_at >= now() - interval '24 hours'
          and status <> 'success'
        order by source_id, finished_at desc
      )
      select
        s.id,
        s.last_error,
        coalesce(rp.recent_count, 0) as recent_count,
        coalesce(rs.total_runs_24h, 0) as total_runs_24h,
        coalesce(rs.success_runs_24h, 0) as success_runs_24h,
        lf.recent_error_code,
        lf.recent_error_message
      from sources s
      left join recent_posts rp on rp.source_id = s.id
      left join run_stats rs on rs.source_id = s.id
      left join latest_failure lf on lf.source_id = s.id
      order by s.id asc
      `
    ),
    pool.query<{
      total_runs_24h: number | string | null;
      success_runs_24h: number | string | null;
      p95_latency_ms_24h: number | string | null;
    }>(
      `
      select
        count(*) as total_runs_24h,
        count(*) filter (where status = 'success') as success_runs_24h,
        percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms_24h
      from collector_runs
      where started_at >= now() - interval '24 hours'
      `
    ),
  ]);

  const rows = sourceRowsResult.rows;
  const degradedCodes = new Map<string, number>();
  let healthy = 0;
  let degraded = 0;
  let autoDisabled = 0;

  for (const row of rows) {
    const recentCount = toNumber(row.recent_count);
    const totalRuns24h = toNumber(row.total_runs_24h);
    const successRuns24h = toNumber(row.success_runs_24h);
    const successRate = totalRuns24h > 0 ? (successRuns24h / totalRuns24h) * 100 : 0;
    const autoDisabledRow = Boolean(row.last_error?.startsWith("auto_disabled_consecutive_failures"));
    const isDegraded = recentCount < 1 || Boolean(row.recent_error_code) || (totalRuns24h > 0 && successRate < 70);

    if (autoDisabledRow) autoDisabled += 1;
    if (!isDegraded) {
      healthy += 1;
      continue;
    }
    degraded += 1;
    const code = recentCount < 1 ? "no_data_24h" : row.recent_error_code ?? normalizeErrorCode(row.last_error);
    degradedCodes.set(code, (degradedCodes.get(code) ?? 0) + 1);
  }

  const collectorRunRow = collectorRunsResult.rows[0];
  const collectorTotalRuns = toNumber(collectorRunRow?.total_runs_24h);
  const collectorSuccessRuns = toNumber(collectorRunRow?.success_runs_24h);
  const collectorSuccessRate = collectorTotalRuns > 0 ? collectorSuccessRuns / collectorTotalRuns : 0;

  return {
    healthySources: healthy,
    degradedSources: degraded,
    totalSources: rows.length,
    autoDisabledSources24h: autoDisabled,
    degradedTopCodes: [...degradedCodes.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([code, count]) => ({ code, count })),
    collectorRuns24h: {
      totalRuns: collectorTotalRuns,
      successRuns: collectorSuccessRuns,
      successRate: collectorSuccessRate,
      p95LatencyMs: Number.isFinite(toNumber(collectorRunRow?.p95_latency_ms_24h, Number.NaN))
        ? Math.round(toNumber(collectorRunRow?.p95_latency_ms_24h))
        : null,
    },
  };
}

async function loadRetentionRows(pool: Pool): Promise<RetentionRow[]> {
  return Promise.all(
    REPORT_TABLES.map(async ({ table, tsColumn }) => {
      const [countResult, sizeResult] = await Promise.all([
        pool.query<{ row_count: string; oldest_at: string | null; newest_at: string | null }>(
          `select count(*)::text as row_count, min(${tsColumn})::text as oldest_at, max(${tsColumn})::text as newest_at from ${table}`
        ),
        pool.query<{ size_bytes: number | string | null }>(
          `select pg_total_relation_size(to_regclass($1)) as size_bytes`,
          [table]
        ),
      ]);

      const countRow = countResult.rows[0];
      const sizeRow = sizeResult.rows[0];
      return {
        table,
        rowCount: toNumber(countRow?.row_count),
        sizeBytes: toNumber(sizeRow?.size_bytes),
        oldestAt: countRow?.oldest_at ?? null,
        newestAt: countRow?.newest_at ?? null,
      };
    })
  );
}

async function loadPropagationTopRows(pool: Pool): Promise<PropagationTopRow[]> {
  const freshQuery = await pool.query<Record<string, unknown>>(
    `
    select
      name_en,
      name_ko,
      first_seen_region,
      first_seen_at,
      regions,
      propagation_edges,
      spread_score,
      velocity_per_hour,
      acceleration,
      scope
    from global_topics
    where scope in ('community', 'news')
      and created_at >= now() - interval '72 hours'
    order by created_at desc
    limit 400
    `
  );

  const fallbackRows =
    freshQuery.rows.length > 0
      ? freshQuery.rows
      : (
          await pool.query<Record<string, unknown>>(
            `
            select
              name_en,
              name_ko,
              first_seen_region,
              first_seen_at,
              regions,
              propagation_edges,
              spread_score,
              velocity_per_hour,
              acceleration,
              scope
            from global_topics
            where scope in ('community', 'news')
            order by created_at desc
            limit 300
            `
          )
        ).rows;

  const rows = parseTopicRows(fallbackRows);
  if (rows.length === 0) return [];

  const byCanonical = new Map<
    string,
    {
      nameKo: string;
      nameEn: string;
      firstSeenRegion: string | null;
      firstSeenAt: string | null;
      regions: Set<string>;
      edges: Array<{ lagMinutes: number; confidence: number }>;
      scopes: Set<Scope>;
      bestScore: number;
    }
  >();

  for (const row of rows) {
    const canonical = topicCanonicalKey(row);
    const baseScore = row.spreadScore * 0.5 + row.velocityPerHour * 0.3 + Math.max(row.acceleration, 0) * 0.2;
    const current = byCanonical.get(canonical);
    const rowFirstSeenMs = row.firstSeenAt ? new Date(row.firstSeenAt).getTime() : Number.POSITIVE_INFINITY;

    if (!current) {
      byCanonical.set(canonical, {
        nameKo: row.nameKo,
        nameEn: row.nameEn,
        firstSeenRegion: row.firstSeenRegion,
        firstSeenAt: row.firstSeenAt,
        regions: new Set(row.regions),
        edges: row.propagationEdges.map((edge) => ({ lagMinutes: edge.lagMinutes, confidence: edge.confidence })),
        scopes: new Set([row.scope]),
        bestScore: baseScore,
      });
      continue;
    }

    if ((row.nameKo?.length ?? 0) > (current.nameKo?.length ?? 0)) current.nameKo = row.nameKo;
    if ((row.nameEn?.length ?? 0) > (current.nameEn?.length ?? 0)) current.nameEn = row.nameEn;
    const currentFirstSeenMs = current.firstSeenAt ? new Date(current.firstSeenAt).getTime() : Number.POSITIVE_INFINITY;
    if (rowFirstSeenMs < currentFirstSeenMs) {
      current.firstSeenAt = row.firstSeenAt;
      current.firstSeenRegion = row.firstSeenRegion;
    }
    for (const regionId of row.regions) current.regions.add(regionId);
    for (const edge of row.propagationEdges) current.edges.push({ lagMinutes: edge.lagMinutes, confidence: edge.confidence });
    current.scopes.add(row.scope);
    current.bestScore = Math.max(current.bestScore, baseScore);
  }

  return [...byCanonical.entries()]
    .map(([canonicalKey, entry]) => {
      const lagValues = entry.edges.map((edge) => edge.lagMinutes).filter((value) => Number.isFinite(value) && value >= 0);
      const confidenceValues = entry.edges
        .map((edge) => edge.confidence)
        .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
      const avgLag = lagValues.length > 0 ? lagValues.reduce((sum, value) => sum + value, 0) / lagValues.length : null;
      const avgConfidence = confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : Math.max(0.2, Math.min(0.95, entry.bestScore / 10));
      const crossChecked = entry.scopes.size >= 2;
      return {
        canonicalKey,
        nameKo: entry.nameKo,
        nameEn: entry.nameEn,
        firstSeenRegion: entry.firstSeenRegion,
        firstSeenAt: entry.firstSeenAt,
        regionCount: entry.regions.size,
        lagSummary: avgLag == null ? "-" : `avg ${Math.round(avgLag)}m`,
        confidencePct: Math.round(avgConfidence * 100),
        score: entry.bestScore + (crossChecked ? 0.15 : 0),
        crossChecked,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.regionCount !== left.regionCount) return right.regionCount - left.regionCount;
      return left.canonicalKey.localeCompare(right.canonicalKey, "en-US");
    })
    .slice(0, 5);
}

function buildTopicLabel(row: PropagationTopRow) {
  if (row.nameKo && row.nameEn && row.nameKo !== row.nameEn) return `${row.nameKo} / ${row.nameEn}`;
  return row.nameKo || row.nameEn || row.canonicalKey;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
}

function hasHangul(value: string) {
  return /[\uAC00-\uD7A3]/.test(value);
}

function isKoreanOrEnglishLike(value: string) {
  const letters = [...value].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return true;
  if (hasHangul(value)) return true;
  return letters.every((char) => /[A-Za-z]/.test(char));
}

function pickKoreanTranslation(row: Pick<PropagationTopRow, "nameKo" | "nameEn">) {
  if (row.nameKo && hasHangul(row.nameKo)) return row.nameKo;
  if (row.nameEn && hasHangul(row.nameEn)) return row.nameEn;
  return null;
}

function formatTopicHeadline(row: PropagationTopRow) {
  const ko = row.nameKo?.trim() ?? "";
  const en = row.nameEn?.trim() ?? "";
  const original = !isKoreanOrEnglishLike(en)
    ? en
    : !isKoreanOrEnglishLike(ko)
      ? ko
      : buildTopicLabel(row);

  if (!isKoreanOrEnglishLike(original)) {
    const korean = pickKoreanTranslation(row);
    if (korean && korean !== original) return `${original} (${korean})`;
    return `${original} (\uD55C\uAD6D\uC5B4 \uBC88\uC5ED \uC5C6\uC74C)`;
  }

  if (ko && en && ko !== en) {
    if (hasHangul(ko)) return `${ko} (${en})`;
    return `${en} (${ko})`;
  }

  return original;
}

function enforceTelegramLimit(message: string) {
  if (message.length <= TELEGRAM_SAFE_LENGTH) return message;
  const suffix = "\n\n...(truncated)";
  const allowed = Math.max(0, TELEGRAM_SAFE_LENGTH - suffix.length);
  return `${message.slice(0, allowed)}${suffix}`.slice(0, TELEGRAM_MAX_LENGTH);
}

function buildMessage(args: {
  mode: ReportMode;
  generatedAt: string;
  sinceIso: string;
  collection24h: CollectionCounts24h;
  sourceHealth: SourceHealthSummary;
  retentionRows: RetentionRow[];
  topRows: PropagationTopRow[];
}) {
  const { mode, generatedAt, sinceIso, collection24h, sourceHealth, retentionRows, topRows } = args;

  const lines = [
    `[GlobalPulse][PULSE][${mode.toUpperCase()}]`,
    `\uC0DD\uC131 \uC2DC\uAC01(KST): ${formatIsoKst(generatedAt)}`,
    `\uC9D1\uACC4 \uAD6C\uAC04(KST): ${formatIsoKst(sinceIso)} ~ ${formatIsoKst(generatedAt)} (\uCD5C\uADFC 24\uC2DC\uAC04)`,
    "",
    "1) \uC218\uC9D1 \uC0C1\uD0DC",
    `- \uC18C\uC2A4 \uC0C1\uD0DC: \uC815\uC0C1 ${formatCount(sourceHealth.healthySources)} / \uC800\uD558 ${formatCount(sourceHealth.degradedSources)} / \uC804\uCCB4 ${formatCount(sourceHealth.totalSources)}`,
    `- \uC790\uB3D9 \uBE44\uD65C\uC131(24h): ${formatCount(sourceHealth.autoDisabledSources24h)}`,
    `- \uC624\uB958 \uC0C1\uC704: ${truncateText(sourceHealth.degradedTopCodes.map((item) => `${item.code}(${item.count})`).join(", ") || "-", 84)}`,
    `- \uC218\uC9D1 \uC2E4\uD589(24h): \uCD1D ${formatCount(sourceHealth.collectorRuns24h.totalRuns)}\uD68C, \uC131\uACF5 ${formatCount(sourceHealth.collectorRuns24h.successRuns)}\uD68C (${formatRatio(sourceHealth.collectorRuns24h.successRate)}), p95 ${sourceHealth.collectorRuns24h.p95LatencyMs == null ? "-" : `${formatCount(sourceHealth.collectorRuns24h.p95LatencyMs)}ms`}`,
    `- \uC720\uC785 \uB370\uC774\uD130(24h): raw_posts ${formatCount(collection24h.rawPosts)} | topics ${formatCount(collection24h.topics)} | global_topics ${formatCount(collection24h.globalTopics)} | overlaps ${formatCount(collection24h.issueOverlaps)}`,
    "",
    "2) \uBCF4\uC720 \uC0C1\uD0DC",
  ];

  const retentionDisplayRows = mode === "full" ? retentionRows : retentionRows.slice(0, 4);
  for (const row of retentionDisplayRows) {
    lines.push(
      `- ${row.table}: ${formatCount(row.rowCount)} rows, ${formatTableSize(row.sizeBytes)} (\uBCF4\uC720 ${formatIsoKstShort(row.oldestAt)} ~ ${formatIsoKstShort(row.newestAt)})`
    );
  }
  if (mode === "snap" && retentionRows.length > retentionDisplayRows.length) {
    lines.push(`- \uAE30\uD0C0 ${formatCount(retentionRows.length - retentionDisplayRows.length)}\uAC1C \uD14C\uC774\uBE14\uC740 full \uB9AC\uD3EC\uD2B8\uC5D0\uC11C \uC81C\uACF5`);
  }

  lines.push("", "3) Propagation TOP5");
  if (topRows.length === 0) {
    lines.push("- \uC870\uAC74\uC744 \uD1B5\uACFC\uD55C \uD655\uC0B0 \uC774\uC288\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
  } else {
    topRows.forEach((row, index) => {
      lines.push(`[${index + 1}] ${formatTopicHeadline(row)}`);
      lines.push(`  - \uCD5C\uCD08 \uAD00\uCE21: ${(row.firstSeenRegion ?? "-").toUpperCase()} ${formatIsoKstShort(row.firstSeenAt)}`);
      lines.push(
        `  - \uD655\uC0B0 \uB9AC\uC804: ${formatCount(row.regionCount)} | \uD3C9\uADE0 \uC2DC\uCC28: ${row.lagSummary} | \uC2E0\uB8B0\uB3C4: ${row.confidencePct}% | \uAD50\uCC28\uAC80\uC99D: ${row.crossChecked ? "\uC608" : "\uC544\uB2C8\uC624"}`
      );
    });
  }

  lines.push("", "* \uAD50\uCC28\uAC80\uC99D: community + news \uB3D9\uC2DC \uD3EC\uCC29 \uC5EC\uBD80");
  return enforceTelegramLimit(lines.join("\n"));
}
async function writeReportSnapshot(args: {
  mode: ReportMode;
  generatedAt: string;
  message: string;
  collection24h: CollectionCounts24h;
  sourceHealth: SourceHealthSummary;
  retentionRows: RetentionRow[];
  topRows: PropagationTopRow[];
}) {
  const reportDir = path.join(process.cwd(), ".runtime", "reports");
  await fs.mkdir(reportDir, { recursive: true });
  const payload = {
    mode: args.mode,
    generatedAt: args.generatedAt,
    collection24h: args.collection24h,
    sourceHealth: args.sourceHealth,
    retentionRows: args.retentionRows,
    topRows: args.topRows,
    message: args.message,
  };
  const encoded = JSON.stringify(payload, null, 2);
  const latestPath = path.join(reportDir, `pulse-report-${args.mode}.latest.json`);
  const timestampPath = path.join(reportDir, `pulse-report-${args.mode}.${Date.now()}.json`);
  await Promise.all([fs.writeFile(latestPath, encoded, "utf8"), fs.writeFile(timestampPath, encoded, "utf8")]);
}

async function main() {
  if (!hasPostgresConfig()) {
    const generatedAt = nowIso();
    const mode = parseReportMode();
            const fallbackMessage = enforceTelegramLimit(
      [
        `[GlobalPulse][PULSE][${mode.toUpperCase()}]`,
        `\uC0DD\uC131 \uC2DC\uAC01(KST): ${formatIsoKst(generatedAt)}`,
        "",
        "1) \uC218\uC9D1 \uC0C1\uD0DC",
        "- postgres not configured",
        "",
        "2) \uBCF4\uC720 \uC0C1\uD0DC",
        "- postgres not configured",
        "",
        "3) Propagation TOP5",
        "- postgres not configured",
      ].join("\n")
    );
    await writeReportSnapshot({
      mode,
      generatedAt,
      message: fallbackMessage,
      collection24h: { rawPosts: 0, topics: 0, globalTopics: 0, issueOverlaps: 0 },
      sourceHealth: {
        healthySources: 0,
        degradedSources: 0,
        totalSources: 0,
        autoDisabledSources24h: 0,
        degradedTopCodes: [],
        collectorRuns24h: {
          totalRuns: 0,
          successRuns: 0,
          successRate: 0,
          p95LatencyMs: null,
        },
      },
      retentionRows: [],
      topRows: [],
    });
    process.stdout.write(fallbackMessage);
    return;
  }

  const pool = createPostgresPool();
  const mode = parseReportMode();
  const generatedAt = nowIso();
  const sinceIso = since24hIso();

  const [collection24h, sourceHealth, retentionRows, topRows] = await Promise.all([
    loadCollectionCounts24h(pool),
    loadSourceHealthSummary(pool),
    loadRetentionRows(pool),
    loadPropagationTopRows(pool),
  ]);

  const message = buildMessage({
    mode,
    generatedAt,
    sinceIso,
    collection24h,
    sourceHealth,
    retentionRows,
    topRows,
  });

  await writeReportSnapshot({
    mode,
    generatedAt,
    message,
    collection24h,
    sourceHealth,
    retentionRows,
    topRows,
  });

  process.stdout.write(message);
}

main().catch((error) => {
  console.error(`[pulse-report] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

