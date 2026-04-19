import { NextResponse } from "next/server";
import type { Topic } from "@global-pulse/shared";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";
import {
  mapGlobalTopicRow,
  mapTopicRow,
  type GlobalTopicRow,
  type TopicRow,
} from "../_shared/mappers";

const GEMINI_API_BASE = process.env.GEMINI_API_BASE?.trim() || "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION?.trim() || "v1beta";
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004";
const EMBEDDING_CACHE_SIZE = 500;
const EMBEDDING_CACHE_TTL_MS = 60 * 60 * 1000;
const SEMANTIC_CANDIDATE_LIMIT = 800;
const SEMANTIC_RESULT_LIMIT = 20;

interface EmbeddingCacheEntry {
  vector: number[];
  expiresAt: number;
}

interface SemanticSearchMeta {
  enabled: boolean;
  used: boolean;
  model: string | null;
  cacheHit: boolean;
  candidateCount: number;
}

const embeddingCache = new Map<string, EmbeddingCacheEntry>();

function sanitizeTerm(value: string): string {
  return value.replace(/[%(),]/g, " ").trim();
}

function cosineSimilarity(left: number[] | null, right: number[] | null): number {
  if (!left || !right || left.length === 0 || right.length === 0 || left.length !== right.length) {
    return -1;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }

  if (leftNorm <= 0 || rightNorm <= 0) {
    return -1;
  }

  const cosine = dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  if (!Number.isFinite(cosine)) {
    return -1;
  }
  return Math.max(-1, Math.min(1, cosine));
}

function normalizeEmbedding(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const values = raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  return values.length > 0 ? values : null;
}

function touchCacheKey(key: string, entry: EmbeddingCacheEntry): void {
  embeddingCache.delete(key);
  embeddingCache.set(key, entry);
}

function readEmbeddingFromCache(key: string): number[] | null {
  const entry = embeddingCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    embeddingCache.delete(key);
    return null;
  }
  touchCacheKey(key, entry);
  return entry.vector;
}

function storeEmbeddingInCache(key: string, vector: number[]): void {
  const entry: EmbeddingCacheEntry = {
    vector,
    expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
  };
  touchCacheKey(key, entry);
  while (embeddingCache.size > EMBEDDING_CACHE_SIZE) {
    const oldestKey = embeddingCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    embeddingCache.delete(oldestKey);
  }
}

function embedEndpoint(model: string): string {
  return `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models/${model}:embedContent`;
}

async function embedQueryWithGemini(query: string): Promise<{ vector: number[] | null; cacheHit: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { vector: null, cacheHit: false };
  }

  const cacheKey = query.normalize("NFKC").toLowerCase();
  const fromCache = readEmbeddingFromCache(cacheKey);
  if (fromCache) {
    return { vector: fromCache, cacheHit: true };
  }

  try {
    const response = await fetch(`${embedEndpoint(GEMINI_EMBEDDING_MODEL)}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: query.slice(0, 512) }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { vector: null, cacheHit: false };
    }

    const data = (await response.json()) as {
      embedding?: {
        values?: number[];
      };
    };
    const vector = normalizeEmbedding(data.embedding?.values);
    if (vector) {
      storeEmbeddingInCache(cacheKey, vector);
    }
    return { vector, cacheHit: false };
  } catch {
    return { vector: null, cacheHit: false };
  }
}

function dedupeTopics(topics: Topic[]): Topic[] {
  const seen = new Set<string>();
  const unique: Topic[] = [];

  for (const topic of topics) {
    const key = String(topic.id ?? `${topic.regionId}:${topic.nameEn}:${topic.periodEnd}`);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(topic);
  }

  return unique;
}

async function searchTopics(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const region = searchParams.get("region") ?? null;
  const semanticEnabled = searchParams.get("semantic") !== "false";

  if (!query) {
    return NextResponse.json({
      query,
      region,
      topics: [],
      globalTopics: [],
      total: 0,
      semantic: {
        enabled: semanticEnabled,
        used: false,
        model: semanticEnabled ? GEMINI_EMBEDDING_MODEL : null,
        cacheHit: false,
        candidateCount: 0,
      },
      configured: true,
      provider: "none",
    });
  }

  const postgres = getPostgresPoolOrNull();
  if (!postgres) {
    return NextResponse.json({
      query,
      region,
      topics: [],
      globalTopics: [],
      total: 0,
      semantic: {
        enabled: semanticEnabled,
        used: false,
        model: semanticEnabled ? GEMINI_EMBEDDING_MODEL : null,
        cacheHit: false,
        candidateCount: 0,
      },
      configured: false,
      provider: "none",
    });
  }

  try {
    const term = `%${sanitizeTerm(query)}%`;
    const topicParams: Array<string> = [term];
    let topicWhere = `
      (
        name_ko ilike $1
        or name_en ilike $1
        or coalesce(summary_ko, '') ilike $1
        or coalesce(summary_en, '') ilike $1
      )
    `;

    if (region) {
      topicWhere += " and region_id = $2";
      topicParams.push(region);
    }

    const lexicalTopicsPromise = postgres.query<TopicRow>(
      `
      select
        id,region_id,name_ko,name_en,summary_ko,summary_en,sample_titles,keywords,sentiment,sentiment_distribution,sentiment_reasoning_ko,sentiment_reasoning_en,category,entities,aliases,canonical_key,embedding_json,heat_score,heat_score_display,
        post_count,total_views,total_likes,total_comments,source_ids,raw_post_ids,burst_z,lifecycle_stage,anomaly_score,source_diversity,dominant_source_share,representative_excerpts,
        velocity_per_hour,acceleration,spread_score,propagation_timeline,propagation_edges,scope,rank,period_start,period_end
      from topics
      where ${topicWhere}
      order by heat_score desc
      limit 20
      `,
      topicParams,
    );

    const globalTopicsPromise = postgres.query<GlobalTopicRow>(
      `
      select
        id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
        topic_ids,total_heat_score,heat_score_display,first_seen_region,first_seen_at,velocity_per_hour,acceleration,spread_score,propagation_timeline,propagation_edges,scope,created_at
      from global_topics
      where
        name_ko ilike $1
        or name_en ilike $1
        or coalesce(summary_ko, '') ilike $1
        or coalesce(summary_en, '') ilike $1
      order by total_heat_score desc
      limit 20
      `,
      [term],
    );

    let semanticMeta: SemanticSearchMeta = {
      enabled: semanticEnabled,
      used: false,
      model: semanticEnabled ? GEMINI_EMBEDDING_MODEL : null,
      cacheHit: false,
      candidateCount: 0,
    };

    let semanticTopics: Topic[] = [];
    if (semanticEnabled) {
      const { vector: queryEmbedding, cacheHit } = await embedQueryWithGemini(query);
      semanticMeta = {
        ...semanticMeta,
        cacheHit,
      };

      if (queryEmbedding) {
        const semanticParams: Array<string | number> = [];
        let semanticWhere = "embedding_json is not null";
        if (region) {
          semanticParams.push(region);
          semanticWhere += ` and region_id = $${semanticParams.length}`;
        }
        semanticParams.push(SEMANTIC_CANDIDATE_LIMIT);
        const limitParam = semanticParams.length;

        const candidateSql = `
          select
            id,region_id,name_ko,name_en,summary_ko,summary_en,sample_titles,keywords,sentiment,sentiment_distribution,sentiment_reasoning_ko,sentiment_reasoning_en,category,entities,aliases,canonical_key,embedding_json,heat_score,heat_score_display,
            post_count,total_views,total_likes,total_comments,source_ids,raw_post_ids,burst_z,lifecycle_stage,anomaly_score,source_diversity,dominant_source_share,representative_excerpts,
            velocity_per_hour,acceleration,spread_score,propagation_timeline,propagation_edges,scope,rank,period_start,period_end
          from topics
          where ${semanticWhere}
          order by created_at desc
          limit $${limitParam}
        `;

        const semanticResult = await postgres.query<TopicRow>(candidateSql, semanticParams);
        semanticMeta = {
          ...semanticMeta,
          used: true,
          candidateCount: semanticResult.rows.length,
        };

        const scoredTopics = semanticResult.rows
          .map((row) => {
            const embedding = normalizeEmbedding(row.embedding_json);
            return {
              topic: mapTopicRow(row),
              score: cosineSimilarity(queryEmbedding, embedding),
            };
          })
          .filter((entry) => entry.score >= 0.2)
          .sort((left, right) => right.score - left.score)
          .slice(0, SEMANTIC_RESULT_LIMIT);

        semanticTopics = scoredTopics.map((entry) => entry.topic);
      }
    }

    const [lexicalTopicsResult, globalTopicsResult] = await Promise.all([lexicalTopicsPromise, globalTopicsPromise]);
    const lexicalTopics = lexicalTopicsResult.rows.map(mapTopicRow);
    const globalTopics = globalTopicsResult.rows.map(mapGlobalTopicRow);

    const mergedTopics = dedupeTopics([...semanticTopics, ...lexicalTopics]).slice(0, SEMANTIC_RESULT_LIMIT);

    return NextResponse.json({
      query,
      region,
      topics: mergedTopics,
      globalTopics,
      total: mergedTopics.length + globalTopics.length,
      semantic: semanticMeta,
      configured: true,
      provider: "postgres",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        query,
        region,
        topics: [],
        globalTopics: [],
        total: 0,
        semantic: {
          enabled: semanticEnabled,
          used: false,
          model: semanticEnabled ? GEMINI_EMBEDDING_MODEL : null,
          cacheHit: false,
          candidateCount: 0,
        },
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/search", () => searchTopics(request));
}
