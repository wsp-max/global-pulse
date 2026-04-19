import {
  getRegionById,
  type Topic,
  type TopicCategory,
  type TopicEntity,
  type TopicEntityType,
} from "@global-pulse/shared";
import { getLogger } from "@global-pulse/shared/server-logger";

const GEMINI_API_BASE = process.env.GEMINI_API_BASE?.trim() || "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION?.trim() || "v1beta";
const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
];
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const ANALYZER_LLM_CANONICAL_BATCH = Math.min(
  Math.max(Number(process.env.ANALYZER_LLM_CANONICAL_BATCH ?? 12), 1),
  12,
);
const ANALYZER_GEMINI_TIMEOUT_MS = Math.max(
  Number(process.env.ANALYZER_GEMINI_TIMEOUT_MS ?? 25_000),
  5_000,
);

const CATEGORY_VALUES: TopicCategory[] = [
  "politics",
  "economy",
  "tech",
  "entertainment",
  "sports",
  "society",
  "crime",
  "culture",
  "health",
  "science",
  "other",
];
const ENTITY_TYPE_VALUES: TopicEntityType[] = ["person", "org", "product", "event", "place", "work", "other"];

const LOW_SIGNAL_NAME_TERMS = new Set([
  "news",
  "issue",
  "issues",
  "topic",
  "topics",
  "update",
  "updates",
  "summary",
  "digest",
  "headline",
  "headlines",
  "content",
  "major",
  "related",
  "today",
  "breaking",
  "shocking",
  "exclusive",
  "controversy",
  "viral",
  "legend",
  "오늘",
  "주요",
  "소식",
  "뉴스",
  "이슈",
  "토픽",
  "업데이트",
  "요약",
  "충격",
  "섬뜩",
  "미쳤다",
  "미친",
  "만행",
  "레전드",
  "논란",
  "속보",
  "단독",
  "입수",
  "공개",
  "폭로",
  "衝撃",
  "速報",
  "緊急",
  "悲報",
  "炎上",
  "話題",
  "徹底",
  "震惊",
  "重磅",
  "独家",
  "最新",
  "热议",
]);

let cachedModels: string[] | null = null;
let cachedModelsFetchedAt = 0;

const logger = getLogger("analyzer-gemini");

interface SummarizeOptions {
  regionId: string;
}

export interface GeminiSummarizeStats {
  requestCount: number;
  fallbackCount: number;
  modelUsed: string[];
  durationMs: number;
  promptCharsTotal: number;
  batches: number;
  errors: string[];
}

export interface GeminiSummarizeResult {
  topics: Topic[];
  stats: GeminiSummarizeStats;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface GeminiModelListResponse {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
}

interface GeminiSummaryItem {
  name_ko?: string;
  name_en?: string;
  summary_ko?: string;
  summary_en?: string;
  sentiment?: number;
  category?: string;
  entities?: Array<{ text?: string; type?: string }>;
  aliases?: string[];
}

function sanitizeJsonText(text: string): string {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function normalizeCanonicalKey(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function isLowSignalName(value: string): boolean {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return true;
  }

  const tokens = normalized.split(" ").filter(Boolean);
  let meaningfulCount = 0;
  let lowSignalCount = 0;

  for (const token of tokens) {
    if (token.length < 2) {
      continue;
    }
    if (LOW_SIGNAL_NAME_TERMS.has(token)) {
      lowSignalCount += 1;
      continue;
    }
    meaningfulCount += 1;
  }

  if (meaningfulCount === 0) {
    return true;
  }
  return lowSignalCount >= 1 && meaningfulCount <= 1;
}

function preferMeaningfulName(candidate: string | undefined, fallback: string): string {
  const trimmed = candidate?.trim() ?? "";
  if (!trimmed) {
    return fallback;
  }
  return isLowSignalName(trimmed) ? fallback : trimmed;
}

function toSentiment(value: unknown, fallback: number | null): number | null {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(-1, Math.min(1, Number(numeric.toFixed(3))));
}

function toCategory(value: unknown, fallback: TopicCategory = "other"): TopicCategory {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase() as TopicCategory;
  return CATEGORY_VALUES.includes(normalized) ? normalized : fallback;
}

function toEntities(value: unknown): TopicEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entities: TopicEntity[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const text = typeof item.text === "string" ? item.text.trim() : "";
    const entityType = typeof item.type === "string" ? item.type.trim().toLowerCase() : "";
    if (!text) {
      continue;
    }
    const type = ENTITY_TYPE_VALUES.includes(entityType as TopicEntityType)
      ? (entityType as TopicEntityType)
      : "other";
    entities.push({ text, type });
    if (entities.length >= 12) {
      break;
    }
  }

  return entities;
}

function toAliases(value: unknown, topic: Topic): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const aliases = new Set<string>();
  const reserved = new Set([topic.nameKo.trim(), topic.nameEn.trim()].filter(Boolean));
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const alias = item.trim();
    if (!alias || reserved.has(alias)) {
      continue;
    }
    aliases.add(alias);
    if (aliases.size >= 12) {
      break;
    }
  }

  return [...aliases];
}

function endpointForGenerate(model: string): string {
  return `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models/${model}:generateContent`;
}

function endpointForModels(): string {
  return `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models`;
}

function buildPrompt(regionId: string, topics: Topic[]): string {
  const region = getRegionById(regionId);
  const regionNameKo = region?.nameKo ?? regionId.toUpperCase();
  const regionNameEn = region?.nameEn ?? regionId.toUpperCase();

  const payload = topics.map((topic, index) => ({
    index,
    current_name_ko: topic.nameKo,
    current_name_en: topic.nameEn,
    top_titles: (topic.sampleTitles ?? []).slice(0, 5),
    keywords: topic.keywords.slice(0, 12),
    heat_score: topic.heatScore,
    sentiment: topic.sentiment,
  }));

  return [
    "당신은 글로벌 여론 분석가입니다.",
    `${regionNameKo} (${regionNameEn}) 리전의 토픽을 정제하고 요약하세요.`,
    "반드시 JSON 배열만 반환하세요. 설명 문장이나 마크다운 금지.",
    "각 항목 스키마:",
    `{
  "name_ko": string,
  "name_en": string,
  "summary_ko": string,
  "summary_en": string,
  "sentiment": number,
  "category": "politics" | "economy" | "tech" | "entertainment" | "sports" | "society" | "crime" | "culture" | "health" | "science" | "other",
  "entities": [{ "text": string, "type": "person" | "org" | "product" | "event" | "place" | "work" | "other" }],
  "aliases": string[]
}`,
    "규칙:",
    "1) name_ko는 2~20자, name_en은 2~6단어",
    "2) summary_ko/summary_en은 각각 1~2문장",
    "3) sentiment는 -1.0~1.0",
    "4) entities는 최대 8개",
    "5) aliases는 최대 8개",
    "6) 입력 토픽 순서를 유지",
    "입력 JSON:",
    JSON.stringify(payload),
  ].join("\n");
}

function parseGeminiSummaries(rawText: string): GeminiSummaryItem[] | null {
  const cleaned = sanitizeJsonText(rawText);

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.map((item) => {
      if (!item || typeof item !== "object") {
        return {};
      }
      return item as GeminiSummaryItem;
    });
  } catch {
    return null;
  }
}

async function listAvailableModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedModels && now - cachedModelsFetchedAt < MODEL_CACHE_TTL_MS) {
    return cachedModels;
  }

  try {
    const response = await fetch(`${endpointForModels()}?key=${apiKey}`);
    if (!response.ok) {
      return cachedModels ?? [];
    }

    const data = (await response.json()) as GeminiModelListResponse;
    const models = (data.models ?? [])
      .filter((item) => (item.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((item) => (item.name ?? "").replace(/^models\//, "").trim())
      .filter((model) => model.startsWith("gemini-"));

    cachedModels = [...new Set(models)];
    cachedModelsFetchedAt = now;
    return cachedModels;
  } catch {
    return cachedModels ?? [];
  }
}

async function resolveCandidateModels(apiKey: string): Promise<string[]> {
  const envModels = (process.env.GEMINI_MODEL ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const available = await listAvailableModels(apiKey);
  const orderedAvailable = available.sort((left, right) => {
    const score = (value: string): number => {
      if (value.includes("2.5-flash")) return 0;
      if (value.includes("2.0-flash")) return 1;
      if (value.includes("flash")) return 2;
      return 3;
    };
    return score(left) - score(right) || left.localeCompare(right);
  });

  return [...new Set([...envModels, ...DEFAULT_GEMINI_MODELS, ...orderedAvailable])].slice(0, 12);
}

async function requestGemini(apiKey: string, model: string, prompt: string): Promise<{ text: string; error?: string }> {
  const controller = new AbortController();
  const timeoutRef = setTimeout(() => controller.abort(), ANALYZER_GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${endpointForGenerate(model)}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        text: "",
        error: `timeout after ${ANALYZER_GEMINI_TIMEOUT_MS}ms`,
      };
    }
    return {
      text: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeoutRef);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const compactBody = sanitizeJsonText(body).slice(0, 400);
    return {
      text: "",
      error: `HTTP ${response.status}${compactBody ? ` ${compactBody}` : ""}`,
    };
  }

  const data = (await response.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  return { text };
}

function chunkTopics(topics: Topic[], size: number): Topic[][] {
  if (topics.length <= size) {
    return [topics];
  }

  const chunks: Topic[][] = [];
  for (let cursor = 0; cursor < topics.length; cursor += size) {
    chunks.push(topics.slice(cursor, cursor + size));
  }
  return chunks;
}

function applySummaryItem(topic: Topic, summary: GeminiSummaryItem | undefined): Topic {
  const nameKo = preferMeaningfulName(summary?.name_ko, topic.nameKo);
  const nameEn = preferMeaningfulName(summary?.name_en, topic.nameEn);

  return {
    ...topic,
    nameKo,
    nameEn,
    summaryKo: summary?.summary_ko?.trim() || topic.summaryKo || "요약 준비 중",
    summaryEn: summary?.summary_en?.trim() || topic.summaryEn || "Summary pending",
    sentiment: toSentiment(summary?.sentiment, topic.sentiment),
    category: toCategory(summary?.category),
    entities: toEntities(summary?.entities),
    aliases: toAliases(summary?.aliases, topic),
    canonicalKey: normalizeCanonicalKey(nameEn),
  };
}

export async function summarizeTopicsWithGemini(
  topics: Topic[],
  options: SummarizeOptions,
): Promise<GeminiSummarizeResult> {
  const startedAt = Date.now();
  const fallbackTopics = topics.map((topic) => ({
    ...topic,
    summaryKo: topic.summaryKo ?? "요약 준비 중",
    summaryEn: topic.summaryEn ?? "Summary pending",
    canonicalKey: normalizeCanonicalKey(topic.nameEn),
  }));

  if (topics.length === 0) {
    return {
      topics: [],
      stats: {
        requestCount: 0,
        fallbackCount: 0,
        modelUsed: [],
        durationMs: 0,
        promptCharsTotal: 0,
        batches: 0,
        errors: [],
      },
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return {
      topics: fallbackTopics,
      stats: {
        requestCount: 0,
        fallbackCount: 1,
        modelUsed: [],
        durationMs: Date.now() - startedAt,
        promptCharsTotal: 0,
        batches: 0,
        errors: ["no-api-key"],
      },
    };
  }

  const models = await resolveCandidateModels(apiKey);
  const batches = chunkTopics(topics, ANALYZER_LLM_CANONICAL_BATCH);
  const output: Topic[] = [];
  let requestCount = 0;
  let fallbackCount = 0;
  let promptCharsTotal = 0;
  const usedModels = new Set<string>();
  const allErrors: string[] = [];

  for (const batch of batches) {
    const prompt = buildPrompt(options.regionId, batch);
    promptCharsTotal += prompt.length;
    const batchErrors: string[] = [];
    let summaries: GeminiSummaryItem[] | null = null;

    for (const model of models) {
      requestCount += 1;
      usedModels.add(model);
      const { text, error } = await requestGemini(apiKey, model, prompt);
      if (error) {
        const errorLine = `${model}: ${error}`;
        batchErrors.push(errorLine);
        allErrors.push(errorLine);
        continue;
      }

      if (!text) {
        const emptyError = `${model}: empty response`;
        batchErrors.push(emptyError);
        allErrors.push(emptyError);
        continue;
      }

      const parsed = parseGeminiSummaries(text);
      if (!parsed || parsed.length === 0) {
        const parseError = `${model}: invalid-json`;
        batchErrors.push(parseError);
        allErrors.push(parseError);
        continue;
      }

      summaries = parsed;
      break;
    }

    if (!summaries) {
      fallbackCount += 1;
      logger.warn(
        `[${options.regionId}] gemini canonicalization fallback for batch size=${batch.length}: ${
          batchErrors.slice(0, 4).join(" | ") || "no valid response"
        }`,
      );
      output.push(
        ...batch.map((topic) => ({
          ...topic,
          summaryKo: topic.summaryKo ?? "요약 준비 중",
          summaryEn: topic.summaryEn ?? "Summary pending",
          canonicalKey: normalizeCanonicalKey(topic.nameEn),
        })),
      );
      continue;
    }

    output.push(...batch.map((topic, index) => applySummaryItem(topic, summaries?.[index])));
  }

  const durationMs = Date.now() - startedAt;
  logger.info(
    `[${options.regionId}] gemini canonicalization done batches=${batches.length} calls=${requestCount} fallbacks=${fallbackCount} durationMs=${durationMs}`,
  );

  return {
    topics: output,
    stats: {
      requestCount,
      fallbackCount,
      modelUsed: [...usedModels],
      durationMs,
      promptCharsTotal,
      batches: batches.length,
      errors: allErrors.slice(0, 32),
    },
  };
}
