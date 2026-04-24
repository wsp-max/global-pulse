import { SOURCES, isLowInfoTopicName, resolveMeaningfulTopicNames, type GlobalTopic, type Topic } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";
import type { Pool } from "pg";
import { mapCrossRegionTopics } from "./cross-region-mapper";
import { applyPropagationMetrics, type GlobalTopicHistoryPoint } from "./propagation-metrics";
import { detectScopeOverlaps } from "./scope-overlap";

const logger = getLogger("global-analyzer");
type AnalysisScope = "community" | "news" | "mixed";
const SCOPE_VALUES: AnalysisScope[] = ["community", "news", "mixed"];
const FEATURE_NEWS_PIPELINE = process.env.FEATURE_NEWS_PIPELINE === "true";

interface TopicRow {
  id: number;
  region_id: string;
  name_ko: string;
  name_en: string;
  summary_ko: string | null;
  summary_en: string | null;
  keywords: string[] | null;
  sentiment: number | null;
  heat_score: number | null;
  heat_score_display: number | null;
  post_count: number | null;
  total_views: number | null;
  total_likes: number | null;
  total_comments: number | null;
  source_ids: string[] | null;
  raw_post_ids: number[] | null;
  canonical_key: string | null;
  embedding_json: number[] | null;
  scope: AnalysisScope;
  rank: number | null;
  period_start: string;
  period_end: string;
}

interface TopicFirstPostRow {
  topic_id: number;
  region_id: string;
  first_post_at: string | null;
}

interface GlobalTopicHistoryRow {
  name_en: string;
  name_ko: string;
  scope: AnalysisScope;
  total_heat_score: number | null;
  regional_heat_scores: Record<string, number> | null;
  created_at: string;
}

interface GlobalTopicInsertRow {
  name_en: string;
  name_ko: string;
  scope: AnalysisScope;
  summary_en: string | null;
  summary_ko: string | null;
  regions: string[];
  regional_sentiments: string;
  regional_heat_scores: string;
  topic_ids: number[];
  total_heat_score: number;
  heat_score_display: number;
  first_seen_region: string | null;
  first_seen_at: string | null;
  velocity_per_hour: number;
  acceleration: number;
  spread_score: number;
  propagation_timeline: string;
  propagation_edges: string;
  expires_at: string;
}

interface IssueOverlapSnapshotRow {
  community_topic_id: number;
  news_topic_id: number;
  canonical_key: string | null;
  cosine: number;
  lag_minutes: number;
  leader: "community" | "news" | "tie";
  detected_at: string;
}

interface IssueOverlapEventRow extends IssueOverlapSnapshotRow {
  analyzer_run_at: string;
  region_id: string;
  community_topic_name_ko: string;
  community_topic_name_en: string;
  news_topic_name_ko: string;
  news_topic_name_en: string;
}

interface GlobalAnalysisStorage {
  mode: "postgres";
  fetchTopics(periodStartIso: string, scope: AnalysisScope): Promise<TopicRow[]>;
  fetchTopicFirstPostMoments(topicIds: number[]): Promise<TopicFirstPostRow[]>;
  fetchRecentGlobalTopicHistory(historyHours: number, scope: AnalysisScope): Promise<GlobalTopicHistoryPoint[]>;
  expireActiveGlobalTopics(nowIso: string, scope: AnalysisScope): Promise<void>;
  insertGlobalTopics(rows: GlobalTopicInsertRow[]): Promise<void>;
  upsertIssueOverlaps(rows: IssueOverlapSnapshotRow[]): Promise<void>;
  appendIssueOverlapEvents(rows: IssueOverlapEventRow[]): Promise<void>;
}

function log(message: string): void {
  logger.info(message);
}

function parseArg(flag: string): string | undefined {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseScopeArg(value: string | undefined): AnalysisScope | undefined {
  if (!value) {
    return undefined;
  }
  if (!SCOPE_VALUES.includes(value as AnalysisScope)) {
    throw new Error(`Invalid --scope value "${value}". Allowed: ${SCOPE_VALUES.join("|")}`);
  }
  return value as AnalysisScope;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTopic(row: TopicRow): Topic {
  return {
    id: toNumber(row.id),
    regionId: row.region_id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    summaryKo: row.summary_ko ?? undefined,
    summaryEn: row.summary_en ?? undefined,
    keywords: row.keywords ?? [],
    sentiment: toNullableNumber(row.sentiment),
    heatScore: toNumber(row.heat_score),
    heatScoreDisplay: toNullableNumber(row.heat_score_display),
    postCount: toNumber(row.post_count),
    totalViews: toNumber(row.total_views),
    totalLikes: toNumber(row.total_likes),
    totalComments: toNumber(row.total_comments),
    sourceIds: row.source_ids ?? [],
    rawPostIds: row.raw_post_ids ?? [],
    canonicalKey: row.canonical_key ?? undefined,
    embeddingJson: row.embedding_json ?? undefined,
    scope: row.scope,
    rank: row.rank === null || row.rank === undefined ? undefined : toNumber(row.rank),
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toHeatBand(score: number, max: number): number {
  const safeScore = Math.max(0, Number.isFinite(score) ? score : 0);
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 1);
  const numerator = Math.log10(1 + safeScore);
  const denominator = Math.log10(1 + safeMax);
  if (denominator <= 0) {
    return 0;
  }
  return clamp(Number((numerator / denominator).toFixed(4)), 0, 1);
}

function allowedSourceIdsByRegion(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const source of SOURCES) {
    const set = map.get(source.regionId) ?? new Set<string>();
    set.add(source.id);
    map.set(source.regionId, set);
  }

  return map;
}

const allowedSourcesByRegion = allowedSourceIdsByRegion();

function hasRegionSourceOverlap(regionId: string, sourceIds: string[] | null): boolean {
  if (!sourceIds || sourceIds.length === 0) {
    return false;
  }

  const allowedSources = allowedSourcesByRegion.get(regionId);
  if (!allowedSources || allowedSources.size === 0) {
    return false;
  }

  return sourceIds.some((sourceId) => allowedSources.has(sourceId));
}

const GLOBAL_PLACEHOLDER_NAME_REGEX = /^(🌐|🇰🇷|🇺🇸|🇯🇵|🇨🇳|🇪🇺|🇮🇳|🇧🇷|🇷🇺)\s*토픽\s*#\d+/u;

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function buildKeywordLabel(topics: Topic[]): string | null {
  const keywords = [
    ...new Set(
      topics.flatMap((topic) =>
        (topic.keywords ?? [])
          .map((keyword) => normalizeName(keyword))
          .filter(Boolean),
      ),
    ),
  ];
  if (keywords.length === 0) {
    return null;
  }
  return keywords.slice(0, 3).join(" · ");
}

function sanitizePersistedGlobalName(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = normalizeName(value);
  if (!normalized || GLOBAL_PLACEHOLDER_NAME_REGEX.test(normalized)) {
    return fallback;
  }
  return normalized;
}

function pickBestGlobalName(globalTopic: GlobalTopic, topicMap: Map<number, Topic>): { nameKo: string; nameEn: string } {
  const underlyingTopics = globalTopic.topicIds
    .map((topicId) => topicMap.get(topicId))
    .filter((topic): topic is Topic => Boolean(topic))
    .sort((left, right) => right.heatScore - left.heatScore);

  for (const candidate of underlyingTopics) {
    const resolved = resolveMeaningfulTopicNames({
      nameKo: candidate.nameKo,
      nameEn: candidate.nameEn,
      summaryKo: candidate.summaryKo,
      summaryEn: candidate.summaryEn,
      keywords: candidate.keywords,
    });
    const candidateKo = normalizeName(resolved.nameKo);
    const candidateEn = normalizeName(resolved.nameEn);
    if (!isLowInfoTopicName(candidateKo, "ko") || !isLowInfoTopicName(candidateEn, "en")) {
      return {
        nameKo: candidateKo || candidateEn,
        nameEn: candidateEn || candidateKo,
      };
    }
  }

  const fallbackResolved = resolveMeaningfulTopicNames({
    nameKo: sanitizePersistedGlobalName(globalTopic.nameKo, ""),
    nameEn: sanitizePersistedGlobalName(globalTopic.nameEn, ""),
    summaryKo: globalTopic.summaryKo,
    summaryEn: globalTopic.summaryEn,
    keywords: [
      ...new Set(
        underlyingTopics.flatMap((topic) =>
          (topic.keywords ?? [])
            .map((keyword) => normalizeName(keyword))
            .filter(Boolean),
        ),
      ),
    ],
  });

  return {
    nameKo: fallbackResolved.nameKo || normalizeName(globalTopic.nameKo) || `Global Topic ${globalTopic.id ?? "?"}`,
    nameEn:
      fallbackResolved.nameEn ||
      normalizeName(globalTopic.nameEn) ||
      fallbackResolved.nameKo ||
      normalizeName(globalTopic.nameKo) ||
      `Global Topic ${globalTopic.id ?? "?"}`,
  };
}

function sanitizeGlobalTopicByRegions(topic: GlobalTopic, topicMap: Map<number, Topic>): GlobalTopic | null {
  const filteredRegionEntries = new Map<string, number[]>();

  for (const topicId of topic.topicIds) {
    const regionTopic = topicMap.get(topicId);
    if (!regionTopic) {
      continue;
    }

    if (!hasRegionSourceOverlap(regionTopic.regionId, regionTopic.sourceIds)) {
      continue;
    }

    const current = filteredRegionEntries.get(regionTopic.regionId);
    if (current) {
      current.push(topicId);
    } else {
      filteredRegionEntries.set(regionTopic.regionId, [topicId]);
    }
  }

  const filteredRegions = topic.regions.filter((regionId) => filteredRegionEntries.has(regionId));
  if (filteredRegions.length < 2) {
    return null;
  }

  const regionalHeatScores: Record<string, number> = {};
  const regionalSentiments: Record<string, number> = {};
  const keptTopicIds = new Set<number>();
  const seededTopics: Topic[] = [];

  for (const regionId of filteredRegions) {
    const regionTopicIds = filteredRegionEntries.get(regionId) ?? [];
    for (const regionTopicId of regionTopicIds) {
      keptTopicIds.add(regionTopicId);
    }

    const regionTopics = regionTopicIds
      .map((id) => topicMap.get(id))
      .filter((item): item is Topic => Boolean(item));
    if (regionTopics.length === 0) {
      continue;
    }

    seededTopics.push(...regionTopics);
    const totalHeat = regionTopics.reduce((sum, item) => sum + item.heatScore, 0);
    const regionSentimentValues = regionTopics
      .map((item) => item.sentiment)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const totalSentiment =
      regionSentimentValues.length > 0
        ? regionSentimentValues.reduce((sum, value) => sum + value, 0) / regionSentimentValues.length
        : 0;

    regionalHeatScores[regionId] = Number(totalHeat.toFixed(3));
    regionalSentiments[regionId] = Number(totalSentiment.toFixed(3));
  }

  if (seededTopics.length === 0) {
    return null;
  }

  const firstSeen = [...seededTopics].sort(
    (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
  )[0];

  const totalHeatScore = filteredRegions.reduce((sum, regionId) => sum + (regionalHeatScores[regionId] ?? 0), 0);

  const bestNames = pickBestGlobalName(topic, topicMap);

  return {
    ...topic,
    nameKo: bestNames.nameKo,
    nameEn: bestNames.nameEn,
    regions: filteredRegions,
    regionalHeatScores,
    regionalSentiments,
    topicIds: [...keptTopicIds],
    totalHeatScore: Number(totalHeatScore.toFixed(3)),
    firstSeenRegion: firstSeen.regionId,
    firstSeenAt: firstSeen.periodStart,
  };
}

function toTimestamp(value: string | undefined): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function buildPropagationTimelineForTopic(
  globalTopic: GlobalTopic,
  topicMap: Map<number, Topic>,
  firstPostMap: Map<number, TopicFirstPostRow>,
): Array<{ regionId: string; firstPostAt: string; heatAtDiscovery: number }> {
  const byRegion = new Map<string, { firstPostAt: string; heatAtDiscovery: number }>();

  for (const topicId of globalTopic.topicIds) {
    const topic = topicMap.get(topicId);
    if (!topic) {
      continue;
    }

    const firstPostRow = firstPostMap.get(topicId);
    const firstPostAt = firstPostRow?.first_post_at ?? topic.periodStart;
    const existing = byRegion.get(topic.regionId);

    if (!existing || toTimestamp(firstPostAt) < toTimestamp(existing.firstPostAt)) {
      byRegion.set(topic.regionId, {
        firstPostAt,
        heatAtDiscovery: Number(topic.heatScore.toFixed(3)),
      });
    }
  }

  return [...byRegion.entries()]
    .map(([regionId, payload]) => ({
      regionId,
      firstPostAt: payload.firstPostAt,
      heatAtDiscovery: payload.heatAtDiscovery,
    }))
    .sort((left, right) => toTimestamp(left.firstPostAt) - toTimestamp(right.firstPostAt));
}

function buildBatchInsert<T extends object>(
  tableName: string,
  columns: Array<keyof T & string>,
  rows: T[],
): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const tuples: string[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const placeholders: string[] = [];
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const valueIndex = rowIndex * columns.length + columnIndex + 1;
      placeholders.push(`$${valueIndex}`);
      const value = row[columns[columnIndex]];
      values.push(value === undefined ? null : value);
    }
    tuples.push(`(${placeholders.join(",")})`);
  }

  return {
    sql: `insert into ${tableName} (${columns.join(",")}) values ${tuples.join(",")}`,
    values,
  };
}

function createPostgresStorage(pool: Pool): GlobalAnalysisStorage {
  return {
    mode: "postgres",
    async fetchTopics(periodStartIso, scope) {
      const { rows } = await pool.query<TopicRow>(
        `
        with distinct_region_batches as (
          select distinct region_id, created_at
          from topics
          where period_end >= $1
            and scope = $2
        ),
        latest_region_batches as (
          select
            region_id,
            created_at,
            row_number() over (partition by region_id order by created_at desc) as rn
          from distinct_region_batches
        ),
        selected_region_batches as (
          select region_id, created_at
          from latest_region_batches
          where rn <= 3
        )
        select
          t.id,t.region_id,t.name_ko,t.name_en,t.summary_ko,t.summary_en,t.keywords,t.sentiment,t.heat_score,t.heat_score_display,t.post_count,
          t.total_views,t.total_likes,t.total_comments,t.source_ids,t.raw_post_ids,t.canonical_key,t.embedding_json,t.scope,t.rank,t.period_start,t.period_end
        from topics t
        join selected_region_batches b
          on t.region_id = b.region_id
         and t.created_at = b.created_at
        where t.scope = $2
        order by t.heat_score desc nulls last
        limit 4500
        `,
        [periodStartIso, scope],
      );
      return rows;
    },
    async fetchTopicFirstPostMoments(topicIds) {
      if (topicIds.length === 0) {
        return [];
      }
      const { rows } = await pool.query<TopicFirstPostRow>(
        `
        select
          t.id as topic_id,
          t.region_id,
          coalesce(min(coalesce(rp.posted_at, rp.collected_at)), min(t.period_start)) as first_post_at
        from topics t
        left join raw_posts rp
          on rp.id = any(t.raw_post_ids)
        where t.id = any($1::bigint[])
        group by t.id, t.region_id
        `,
        [topicIds],
      );
      return rows;
    },
    async fetchRecentGlobalTopicHistory(historyHours, scope) {
      const safeHours = Math.max(1, Math.min(historyHours, 168));
      const { rows } = await pool.query<GlobalTopicHistoryRow>(
        `
        select
          name_en,
          name_ko,
          scope,
          total_heat_score,
          regional_heat_scores,
          created_at
        from global_topics
        where created_at >= now() - make_interval(hours => $1)
          and scope = $2
        order by created_at asc
        `,
        [safeHours, scope],
      );

      return rows.map((row) => ({
        nameEn: row.name_en,
        nameKo: row.name_ko,
        totalHeatScore: toNumber(row.total_heat_score),
        regionalHeatScores: row.regional_heat_scores ?? {},
        createdAt: row.created_at,
      }));
    },
    async expireActiveGlobalTopics(nowIso, scope) {
      await pool.query(
        `
        update global_topics
        set expires_at = $1
        where scope = $2
          and (expires_at is null or expires_at > $1)
        `,
        [nowIso, scope],
      );
    },
    async insertGlobalTopics(rows) {
      if (rows.length === 0) return;
      const columns: Array<keyof GlobalTopicInsertRow & string> = [
        "name_en",
        "name_ko",
        "scope",
        "summary_en",
        "summary_ko",
        "regions",
        "regional_sentiments",
        "regional_heat_scores",
        "topic_ids",
        "total_heat_score",
        "heat_score_display",
        "first_seen_region",
        "first_seen_at",
        "velocity_per_hour",
        "acceleration",
        "spread_score",
        "propagation_timeline",
        "propagation_edges",
        "expires_at",
      ];
      const batch = buildBatchInsert("global_topics", columns, rows);
      await pool.query(batch.sql, batch.values);
    },
    async upsertIssueOverlaps(rows) {
      if (rows.length === 0) {
        return;
      }

      const values: unknown[] = [];
      const tuples: string[] = [];
      const columns = [
        "community_topic_id",
        "news_topic_id",
        "canonical_key",
        "cosine",
        "lag_minutes",
        "leader",
        "detected_at",
      ] as const;

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const placeholders: string[] = [];
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
          const valueIndex = rowIndex * columns.length + columnIndex + 1;
          placeholders.push(`$${valueIndex}`);
          values.push(row[columns[columnIndex]]);
        }
        tuples.push(`(${placeholders.join(",")})`);
      }

      await pool.query(
        `
        insert into issue_overlaps (${columns.join(",")})
        values ${tuples.join(",")}
        on conflict (community_topic_id, news_topic_id)
        do update
        set
          canonical_key = excluded.canonical_key,
          cosine = excluded.cosine,
          lag_minutes = excluded.lag_minutes,
          leader = excluded.leader,
          detected_at = excluded.detected_at
        `,
        values,
      );
    },
    async appendIssueOverlapEvents(rows) {
      if (rows.length === 0) {
        return;
      }

      const values: unknown[] = [];
      const tuples: string[] = [];
      const columns = [
        "analyzer_run_at",
        "detected_at",
        "region_id",
        "leader",
        "lag_minutes",
        "cosine",
        "canonical_key",
        "community_topic_id",
        "news_topic_id",
        "community_topic_name_ko",
        "community_topic_name_en",
        "news_topic_name_ko",
        "news_topic_name_en",
      ] as const;

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const placeholders: string[] = [];
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
          const valueIndex = rowIndex * columns.length + columnIndex + 1;
          placeholders.push(`$${valueIndex}`);
          values.push(row[columns[columnIndex]]);
        }
        tuples.push(`(${placeholders.join(",")})`);
      }

      await pool.query(
        `
        insert into issue_overlap_events (${columns.join(",")})
        values ${tuples.join(",")}
        on conflict (analyzer_run_at, community_topic_id, news_topic_id)
        do nothing
        `,
        values,
      );
    },
  };
}

function resolveStorage(): GlobalAnalysisStorage | null {
  if (!hasPostgresConfig()) {
    log("PostgreSQL configuration missing. Skipping global analysis run.");
    return null;
  }

  const pool = createPostgresPool();
  return createPostgresStorage(pool);
}

async function runGlobalAnalysis(): Promise<void> {
  const scopeArg = parseScopeArg(parseArg("--scope"));
  const hours = Number(parseArg("--hours") ?? 24);
  const limit = Math.min(Number(parseArg("--limit") ?? 75), 100);
  const minRegions = Math.max(Number(parseArg("--min-regions") ?? 2), 2);
  const similarity = Number(parseArg("--similarity") ?? 0.24);

  const windowHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 168) : 24;
  const threshold = Number.isFinite(similarity)
    ? Math.max(0.05, Math.min(similarity, 0.95))
    : 0.24;

  const storage = resolveStorage();
  if (!storage) {
    return;
  }

  const analyzerRunAtIso = new Date().toISOString();
  const scopes: AnalysisScope[] = scopeArg
    ? [scopeArg]
    : FEATURE_NEWS_PIPELINE
      ? ["community", "news", "mixed"]
      : ["community"];

  for (const scope of scopes) {
    const now = new Date();
    const nowIso = now.toISOString();
    const periodStartIso = new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();

    log(
      `Starting global analysis. db=${storage.mode} scope=${scope} window=${windowHours}h minRegions=${minRegions} similarity=${threshold}`,
    );

    const historyPoints = await storage.fetchRecentGlobalTopicHistory(30, scope);
    await storage.expireActiveGlobalTopics(nowIso, scope);

    const fetchedTopics = (await storage.fetchTopics(periodStartIso, scope))
      .map(toTopic)
      .filter((topic) => hasRegionSourceOverlap(topic.regionId, topic.sourceIds));
    if (fetchedTopics.length === 0) {
      log(`[${scope}] no recent topics found. Global topic table has been expired for this run.`);
      continue;
    }

    const topicById = new Map<number, Topic>(fetchedTopics.map((topic) => [topic.id ?? 0, topic]));
    const mapped = mapCrossRegionTopics(fetchedTopics, {
      similarityThreshold: threshold,
      minRegions,
    })
      .map((topic) => sanitizeGlobalTopicByRegions(topic, topicById))
      .filter((topic): topic is GlobalTopic => Boolean(topic))
      .slice(0, limit);

    if (mapped.length === 0) {
      log(`[${scope}] no cross-region topics matched after mapping. Keeping currently active global topics.`);
      continue;
    }

    const allTopicIds = [...new Set(mapped.flatMap((topic) => topic.topicIds))];
    const firstPostRows = await storage.fetchTopicFirstPostMoments(allTopicIds);
    const firstPostByTopicId = new Map<number, TopicFirstPostRow>(
      firstPostRows.map((row) => [toNumber(row.topic_id), row]),
    );

    const enrichedMapped = mapped.map((topic) => {
      const propagationTimeline = buildPropagationTimelineForTopic(topic, topicById, firstPostByTopicId);
      const origin = propagationTimeline[0];

      return {
        ...topic,
        firstSeenRegion: origin?.regionId ?? topic.firstSeenRegion,
        firstSeenAt: origin?.firstPostAt ?? topic.firstSeenAt,
        propagationTimeline,
      };
    });

    const metricsApplied = applyPropagationMetrics(enrichedMapped, historyPoints, nowIso);
    const maxTotalHeat = Math.max(...metricsApplied.map((topic) => topic.totalHeatScore), 1);

    const payload: GlobalTopicInsertRow[] = metricsApplied.map((topic) => {
      const keywordFallback = buildKeywordLabel(
        topic.topicIds
          .map((topicId) => topicById.get(topicId))
          .filter((item): item is Topic => Boolean(item)),
      );
      const fallbackName = keywordFallback || "Global Issue";
      const safeNameKo = sanitizePersistedGlobalName(topic.nameKo, fallbackName);
      const safeNameEn = sanitizePersistedGlobalName(topic.nameEn, safeNameKo || fallbackName);

      return {
        name_en: safeNameEn,
        name_ko: safeNameKo,
        scope,
        summary_en: topic.summaryEn ?? null,
        summary_ko: topic.summaryKo ?? null,
        regions: topic.regions,
        regional_sentiments: JSON.stringify(topic.regionalSentiments),
        regional_heat_scores: JSON.stringify(topic.regionalHeatScores),
        topic_ids: topic.topicIds,
        total_heat_score: topic.totalHeatScore,
        heat_score_display: toHeatBand(topic.totalHeatScore, maxTotalHeat),
        first_seen_region: topic.firstSeenRegion ?? null,
        first_seen_at: topic.firstSeenAt ?? null,
        velocity_per_hour: Number(topic.velocityPerHour ?? 0),
        acceleration: Number(topic.acceleration ?? 0),
        spread_score: Number(topic.spreadScore ?? 0),
        propagation_timeline: JSON.stringify(topic.propagationTimeline ?? []),
        propagation_edges: JSON.stringify(topic.propagationEdges ?? []),
        expires_at: expiresAt,
      };
    });

    await storage.insertGlobalTopics(payload);
    log(`[${scope}] global analysis completed. generated=${metricsApplied.length}`);
  }

  const overlapNow = new Date();
  const overlapNowIso = overlapNow.toISOString();
  const overlapPeriodStartIso = new Date(overlapNow.getTime() - windowHours * 60 * 60 * 1000).toISOString();

  const [communityCandidates, newsCandidates] = await Promise.all([
    storage.fetchTopics(overlapPeriodStartIso, "community"),
    storage.fetchTopics(overlapPeriodStartIso, "news"),
  ]);

  const normalizedCommunityTopics = communityCandidates
    .map(toTopic)
    .filter((topic) => hasRegionSourceOverlap(topic.regionId, topic.sourceIds));
  const normalizedNewsTopics = newsCandidates
    .map(toTopic)
    .filter((topic) => hasRegionSourceOverlap(topic.regionId, topic.sourceIds));

  if (normalizedCommunityTopics.length === 0 || normalizedNewsTopics.length === 0) {
    log(`[overlap] skipped. community_topics=${normalizedCommunityTopics.length} news_topics=${normalizedNewsTopics.length}`);
    return;
  }

  const overlapTopicIds = [
    ...new Set(
      [...normalizedCommunityTopics, ...normalizedNewsTopics]
        .map((topic) => topic.id ?? 0)
        .filter((id) => id > 0),
    ),
  ];
  const overlapFirstPostRows = await storage.fetchTopicFirstPostMoments(overlapTopicIds);
  const overlapFirstPostByTopicId = new Map<number, TopicFirstPostRow>(
    overlapFirstPostRows.map((row) => [toNumber(row.topic_id), row]),
  );

  const overlaps = detectScopeOverlaps(
    normalizedCommunityTopics.map((topic) => ({
      ...topic,
      firstPostAt: overlapFirstPostByTopicId.get(topic.id ?? 0)?.first_post_at ?? topic.periodStart,
    })),
    normalizedNewsTopics.map((topic) => ({
      ...topic,
      firstPostAt: overlapFirstPostByTopicId.get(topic.id ?? 0)?.first_post_at ?? topic.periodStart,
    })),
  );

  const communityTopicById = new Map<number, Topic>(
    normalizedCommunityTopics
      .filter((topic) => (topic.id ?? 0) > 0)
      .map((topic) => [topic.id ?? 0, topic]),
  );
  const newsTopicById = new Map<number, Topic>(
    normalizedNewsTopics
      .filter((topic) => (topic.id ?? 0) > 0)
      .map((topic) => [topic.id ?? 0, topic]),
  );

  const snapshotRows: IssueOverlapSnapshotRow[] = [];
  const eventRows: IssueOverlapEventRow[] = [];

  for (const item of overlaps) {
    const communityTopic = communityTopicById.get(item.communityTopicId);
    const newsTopic = newsTopicById.get(item.newsTopicId);
    const regionId = communityTopic?.regionId ?? newsTopic?.regionId;

    if (!regionId) {
      continue;
    }

    const snapshotRow: IssueOverlapSnapshotRow = {
      community_topic_id: item.communityTopicId,
      news_topic_id: item.newsTopicId,
      canonical_key: item.canonicalKey,
      cosine: Number(item.cosine.toFixed(6)),
      lag_minutes: item.lagMinutes,
      leader: item.leader,
      detected_at: overlapNowIso,
    };
    snapshotRows.push(snapshotRow);

    eventRows.push({
      analyzer_run_at: analyzerRunAtIso,
      detected_at: overlapNowIso,
      region_id: regionId,
      leader: item.leader,
      lag_minutes: item.lagMinutes,
      cosine: Number(item.cosine.toFixed(6)),
      canonical_key: item.canonicalKey,
      community_topic_id: item.communityTopicId,
      news_topic_id: item.newsTopicId,
      community_topic_name_ko: communityTopic?.nameKo ?? "",
      community_topic_name_en: communityTopic?.nameEn ?? "",
      news_topic_name_ko: newsTopic?.nameKo ?? "",
      news_topic_name_en: newsTopic?.nameEn ?? "",
    });
  }

  await storage.upsertIssueOverlaps(snapshotRows);
  await storage.appendIssueOverlapEvents(eventRows);

  log(
    `[overlap] completed. snapshots=${snapshotRows.length} events=${eventRows.length} analyzer_run_at=${analyzerRunAtIso}`,
  );
}

runGlobalAnalysis().catch((error) => {
  logger.error(`Global analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

