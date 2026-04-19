import { getRegionById, type Topic } from "@global-pulse/shared";

const GEMINI_API_BASE = process.env.GEMINI_API_BASE?.trim() || "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION?.trim() || "v1beta";
const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite"];
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedModels: string[] | null = null;
let cachedModelsFetchedAt = 0;

interface SummarizeOptions {
  regionId: string;
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
}

function sanitizeJsonText(text: string): string {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
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
    topic_name: topic.nameEn,
    keywords: topic.keywords,
    heat_score: topic.heatScore,
    sentiment: topic.sentiment,
  }));

  return [
    "당신은 글로벌 여론 분석가입니다.",
    `${regionNameKo} (${regionNameEn}) 리전 토픽을 간결하게 정리해 주세요.`,
    "입력 토픽과 동일한 순서/개수로 JSON 배열만 반환해야 합니다.",
    "각 항목 스키마:",
    '{ "name_ko": string, "name_en": string, "summary_ko": string, "summary_en": string, "sentiment": number }',
    "규칙:",
    "1) summary_ko/summary_en는 각각 1~2문장",
    "2) sentiment는 -1.0~1.0",
    "3) 마크다운/설명 문장 금지",
    "토픽 입력 JSON:",
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
  const response = await fetch(`${endpointForGenerate(model)}?key=${apiKey}`, {
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
  });

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

export async function summarizeTopicsWithGemini(
  topics: Topic[],
  options: SummarizeOptions,
): Promise<Topic[]> {
  if (topics.length === 0) {
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return topics.map((topic) => ({
      ...topic,
      summaryKo: topic.summaryKo ?? "요약 준비 중",
      summaryEn: topic.summaryEn ?? "Summary pending",
    }));
  }

  const prompt = buildPrompt(options.regionId, topics);
  const models = await resolveCandidateModels(apiKey);
  const errors: string[] = [];

  for (const model of models) {
    const { text, error } = await requestGemini(apiKey, model, prompt);
    if (error) {
      errors.push(`${model}: ${error}`);
      continue;
    }

    if (!text) {
      continue;
    }

    const summaries = parseGeminiSummaries(text);
    if (!summaries || summaries.length === 0) {
      return topics;
    }

    return topics.map((topic, index) => {
      const summary = summaries[index] ?? {};
      return {
        ...topic,
        nameKo: summary.name_ko?.trim() || topic.nameKo,
        nameEn: summary.name_en?.trim() || topic.nameEn,
        summaryKo: summary.summary_ko?.trim() || topic.summaryKo || "요약 준비 중",
        summaryEn: summary.summary_en?.trim() || topic.summaryEn || "Summary pending",
        sentiment: toSentiment(summary.sentiment, topic.sentiment),
      };
    });
  }

  throw new Error(
    `Gemini API request failed for all candidate models: ${errors.slice(0, 4).join(" | ") || "no response"}`,
  );
}
