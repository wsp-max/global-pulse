import {
  getRegionById,
  type Topic,
  type TopicCategory,
  type TopicEntity,
  type TopicEntityType,
} from "@global-pulse/shared";
import { getLogger } from "@global-pulse/shared/server-logger";
import {
  distributionFromSentiment,
  normalizeSentimentDistribution,
  normalizeSentimentReasoning,
} from "./sentiment";

const GEMINI_API_BASE = process.env.GEMINI_API_BASE?.trim() || "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION?.trim() || "v1beta";
const GEMINI_MODEL_PRIMARY = process.env.GEMINI_MODEL_PRIMARY?.trim() || "gemini-2.5-flash";
const GEMINI_MODEL_FALLBACK = process.env.GEMINI_MODEL_FALLBACK?.trim() || "gemini-2.0-flash";
const DEFAULT_GEMINI_MODELS = [
  GEMINI_MODEL_PRIMARY,
  GEMINI_MODEL_FALLBACK,
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

const GROQ_API_BASE = process.env.GROQ_API_BASE?.trim() || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "moonshotai/kimi-k2-instruct-0905";
const GROQ_MODEL_FALLBACK = process.env.GROQ_MODEL_FALLBACK?.trim() || "llama-3.3-70b-versatile";
const ANALYZER_GROQ_TIMEOUT_MS = Math.max(
  Number(process.env.ANALYZER_GROQ_TIMEOUT_MS ?? 30_000),
  5_000,
);

const FALLBACK_SUMMARY_KO = "요약 준비 중";
const FALLBACK_SUMMARY_EN = "Summary pending";
const FALLBACK_SENTIMENT_REASONING_KO = "감성 근거 분석 중";
const FALLBACK_SENTIMENT_REASONING_EN = "Sentiment reasoning pending";
const SUMMARY_MIN_LENGTH = 80;

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
  "충격",
  "섬뜩",
  "미쳤다",
  "미친",
  "만행",
  "레전드",
  "논란",
  "속보",
  "단독",
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

const RESPONSE_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    required: ["name_ko", "name_en", "summary_ko", "summary_en", "sentiment", "sentiment_distribution", "sentiment_reasoning_ko", "sentiment_reasoning_en", "category", "entities", "aliases"],
    properties: {
      name_ko: { type: "string", minLength: 6, maxLength: 32 },
      name_en: { type: "string", minLength: 8, maxLength: 80 },
      summary_ko: { type: "string", minLength: SUMMARY_MIN_LENGTH, maxLength: 600 },
      summary_en: { type: "string", minLength: SUMMARY_MIN_LENGTH, maxLength: 600 },
      sentiment: { type: "number", minimum: -1, maximum: 1 },
      sentiment_distribution: {
        type: "object",
        required: ["positive", "negative", "neutral", "controversial"],
        properties: {
          positive: { type: "number", minimum: 0, maximum: 1 },
          negative: { type: "number", minimum: 0, maximum: 1 },
          neutral: { type: "number", minimum: 0, maximum: 1 },
          controversial: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      sentiment_reasoning_ko: { type: "string", minLength: 2, maxLength: 60 },
      sentiment_reasoning_en: { type: "string", minLength: 2, maxLength: 120 },
      category: { type: "string", enum: CATEGORY_VALUES },
      entities: {
        type: "array",
        items: {
          type: "object",
          required: ["text", "type"],
          properties: {
            text: { type: "string", minLength: 1, maxLength: 80 },
            type: { type: "string", enum: ENTITY_TYPE_VALUES },
          },
        },
      },
      aliases: {
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 80 },
      },
    },
  },
};

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
  sentiment_distribution?: {
    positive?: number;
    negative?: number;
    neutral?: number;
    controversial?: number;
  };
  sentiment_reasoning_ko?: string;
  sentiment_reasoning_en?: string;
  category?: string;
  entities?: Array<{ text?: string; type?: string }>;
  aliases?: string[];
}

interface RequestGeminiResult {
  text: string;
  error?: string;
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
  return lowSignalCount >= 2 || (lowSignalCount >= 1 && meaningfulCount === 0);
}

function preferMeaningfulName(candidate: string | undefined, fallback: string): string {
  const trimmed = candidate?.trim() ?? "";
  if (!trimmed) {
    return fallback;
  }
  return isLowSignalName(trimmed) ? fallback : trimmed;
}

function sentenceCount(text: string): number {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return 0;
  }

  const punctuated = normalized
    .split(/(?<=[.!?。！？])\s+/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (punctuated.length > 0) {
    return punctuated.length;
  }

  return normalized
    .split(/\n+/u)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function isValidSummaryText(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length < SUMMARY_MIN_LENGTH) {
    return false;
  }
  const count = sentenceCount(trimmed);
  return count >= 2 && count <= 3;
}

function toSentiment(value: unknown, fallback: number | null): number | null {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(-1, Math.min(1, Number(numeric.toFixed(1))));
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
    representative_posts: (topic.sampleTitles ?? []).slice(0, 5),
    keywords: topic.keywords.slice(0, 12),
    heat_score: topic.heatScore,
    sentiment: topic.sentiment,
  }));

  return [
    "You are a global social-signal analyst.",
    `Region: ${regionNameKo} (${regionNameEn})`,
    "Return ONLY a JSON array. No markdown, no explanation.",
    "For each topic, output this schema exactly:",
    JSON.stringify(RESPONSE_SCHEMA.items.properties),
    "Rules:",
    "1) summary_ko와 summary_en은 정확히 2-3개 완전한 문장, 각 요약은 최소 80자이고 trigger/event, who-or-what, dominant sentiment와 reason을 모두 포함할 것.",
    "2) Each summary must include: trigger/event, who-or-what involved, dominant sentiment and reason.",
    "3) name_ko는 6-30자 사이의 짧은 구로, 단일 단어 금지. 주어(사람/기관/작품 등)와 사건/상태를 함께 담을 것. 예: '이재명 대북송금 재판 증인 교체', '용산 전세사기 피해자 집회', '삼성 HBM4 양산 일정 지연'. name_en은 8-70자 사이 2-6 단어 명사구, Title Case, 헤드라인 스타일. 클릭베이트 감탄사(Shocking, Breaking, Exclusive, Revealed, Jaw-dropping 등) 금지. 감탄 부호(!)와 물음표(?)도 금지.",
    "4) Keep input topic order unchanged in output.",
    "5) sentiment_reasoning_ko must be <= 60 chars and sentiment_reasoning_en <= 120 chars.",
    "6) sentiment_distribution must sum approximately to 1.0 and reflect controversial mood when positive and negative are both high.",
    "7) name_ko와 name_en은 서로 같은 의미를 담되 축자 번역이 아닌 지역 뉴스 헤드라인 관습을 따를 것.",
    "Input topics JSON:",
    JSON.stringify(payload),
  ].join("\n");
}

function parseGeminiSummaries(rawText: string): GeminiSummaryItem[] | null {
  const cleaned = sanitizeJsonText(rawText);

  try {
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { topics?: unknown }).topics)
        ? ((parsed as { topics: unknown[] }).topics)
        : null;
    if (!list) {
      return null;
    }

    return list.map((item) => {
      if (!item || typeof item !== "object") {
        return {};
      }
      return item as GeminiSummaryItem;
    });
  } catch {
    return null;
  }
}

function isValidSummaryBatch(summaries: GeminiSummaryItem[] | null, expectedCount: number): boolean {
  if (!summaries || summaries.length < expectedCount) {
    return false;
  }

  for (let index = 0; index < expectedCount; index += 1) {
    const item = summaries[index];
    if (!item) {
      return false;
    }
    if (!isValidSummaryText(item.summary_ko) || !isValidSummaryText(item.summary_en)) {
      return false;
    }
  }

  return true;
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

async function requestGemini(apiKey: string, model: string, prompt: string): Promise<RequestGeminiResult> {
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
          topP: 0.9,
          maxOutputTokens: 1536,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
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

async function requestGroq(apiKey: string, prompt: string, model: string): Promise<RequestGeminiResult> {
  const controller = new AbortController();
  const timeoutRef = setTimeout(() => controller.abort(), ANALYZER_GROQ_TIMEOUT_MS);

  const wrappedPrompt = `${prompt}\n\nReturn a JSON object shaped as {"topics": [...]} where topics is the array described above.`;

  let response: Response;
  try {
    response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: wrappedPrompt }],
        temperature: 0.2,
        top_p: 0.9,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { text: "", error: `timeout after ${ANALYZER_GROQ_TIMEOUT_MS}ms` };
    }
    return { text: "", error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeoutRef);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const compactBody = sanitizeJsonText(body).slice(0, 400);
    return { text: "", error: `HTTP ${response.status}${compactBody ? ` ${compactBody}` : ""}` };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
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
  let nameKo = preferMeaningfulName(summary?.name_ko, topic.nameKo);
  let nameEn = preferMeaningfulName(summary?.name_en, topic.nameEn);
  const sentiment = toSentiment(summary?.sentiment, topic.sentiment);

  const summaryKo = isValidSummaryText(summary?.summary_ko)
    ? summary?.summary_ko?.trim()
    : topic.summaryKo ?? FALLBACK_SUMMARY_KO;
  const summaryEn = isValidSummaryText(summary?.summary_en)
    ? summary?.summary_en?.trim()
    : topic.summaryEn ?? FALLBACK_SUMMARY_EN;
  const sampleTitles = topic.sampleTitles ?? [];
  if (nameKo.split(/\s+/u).filter(Boolean).length < 2) {
    const koCandidate =
      sampleTitles
        .filter((title) => /[가-힣]/u.test(title))
        .map((title) => title.trim())
        .filter((title) => title.length >= 16 && title.length <= 32)
        .sort((left, right) => right.length - left.length)[0] ?? null;
    if (koCandidate) {
      nameKo = koCandidate;
    }
  }
  if (nameEn.split(/\s+/u).filter(Boolean).length < 2) {
    const enCandidate =
      sampleTitles
        .filter((title) => /[A-Za-z]/.test(title))
        .map((title) => title.replace(/\s+/g, " ").trim())
        .filter((title) => title.length >= 16 && title.length <= 32)
        .sort((left, right) => right.length - left.length)[0] ?? null;
    if (enCandidate) {
      nameEn = enCandidate;
    }
  }

  return {
    ...topic,
    nameKo,
    nameEn,
    summaryKo,
    summaryEn,
    sentiment,
    sentimentDistribution: normalizeSentimentDistribution(summary?.sentiment_distribution, sentiment),
    sentimentReasoningKo: normalizeSentimentReasoning(
      summary?.sentiment_reasoning_ko,
      topic.sentimentReasoningKo ?? FALLBACK_SENTIMENT_REASONING_KO,
    ),
    sentimentReasoningEn: normalizeSentimentReasoning(
      summary?.sentiment_reasoning_en,
      topic.sentimentReasoningEn ?? FALLBACK_SENTIMENT_REASONING_EN,
    ),
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
    summaryKo: topic.summaryKo ?? FALLBACK_SUMMARY_KO,
    summaryEn: topic.summaryEn ?? FALLBACK_SUMMARY_EN,
    sentimentDistribution: topic.sentimentDistribution ?? distributionFromSentiment(topic.sentiment),
    sentimentReasoningKo: topic.sentimentReasoningKo ?? FALLBACK_SENTIMENT_REASONING_KO,
    sentimentReasoningEn: topic.sentimentReasoningEn ?? FALLBACK_SENTIMENT_REASONING_EN,
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

  const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  const groqKey = process.env.GROQ_API_KEY?.trim() ?? "";

  if (!geminiKey && !groqKey) {
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

  const models = geminiKey ? await resolveCandidateModels(geminiKey) : [];
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

    if (geminiKey) {
      for (const model of models) {
        usedModels.add(model);

        let modelSuccess = false;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          requestCount += 1;
          const { text, error } = await requestGemini(geminiKey, model, prompt);

          if (error) {
            const errorLine = `${model}: ${error}`;
            batchErrors.push(errorLine);
            allErrors.push(errorLine);
            break;
          }

          if (!text) {
            const emptyError = `${model}: empty response`;
            batchErrors.push(emptyError);
            allErrors.push(emptyError);
            continue;
          }

          const parsed = parseGeminiSummaries(text);
          if (!isValidSummaryBatch(parsed, batch.length)) {
            const validationError = `${model}: invalid-or-short-summary attempt=${attempt + 1}`;
            batchErrors.push(validationError);
            allErrors.push(validationError);
            continue;
          }

          summaries = parsed;
          modelSuccess = true;
          break;
        }

        if (modelSuccess) {
          break;
        }
      }
    }

    if (!summaries && groqKey) {
      const groqModels = [...new Set([GROQ_MODEL, GROQ_MODEL_FALLBACK].filter(Boolean))];
      for (const groqModel of groqModels) {
        usedModels.add(`groq:${groqModel}`);
        for (let attempt = 0; attempt < 2; attempt += 1) {
          requestCount += 1;
          const { text, error } = await requestGroq(groqKey, prompt, groqModel);

          if (error) {
            const errorLine = `groq:${groqModel}: ${error}`;
            batchErrors.push(errorLine);
            allErrors.push(errorLine);
            break;
          }

          if (!text) {
            const emptyError = `groq:${groqModel}: empty response`;
            batchErrors.push(emptyError);
            allErrors.push(emptyError);
            continue;
          }

          const parsed = parseGeminiSummaries(text);
          if (!isValidSummaryBatch(parsed, batch.length)) {
            const validationError = `groq:${groqModel}: invalid-or-short-summary attempt=${attempt + 1}`;
            batchErrors.push(validationError);
            allErrors.push(validationError);
            continue;
          }

          summaries = parsed;
          break;
        }

        if (summaries) {
          break;
        }
      }
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
          summaryKo: topic.summaryKo ?? FALLBACK_SUMMARY_KO,
          summaryEn: topic.summaryEn ?? FALLBACK_SUMMARY_EN,
          sentimentDistribution: topic.sentimentDistribution ?? distributionFromSentiment(topic.sentiment),
          sentimentReasoningKo: topic.sentimentReasoningKo ?? FALLBACK_SENTIMENT_REASONING_KO,
          sentimentReasoningEn: topic.sentimentReasoningEn ?? FALLBACK_SENTIMENT_REASONING_EN,
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
      errors: allErrors.slice(0, 64),
    },
  };
}
