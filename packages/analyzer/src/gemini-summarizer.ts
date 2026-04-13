import { getRegionById, type Topic } from "@global-pulse/shared";

const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

interface GeminiSummaryItem {
  name_ko?: string;
  name_en?: string;
  summary_ko?: string;
  summary_en?: string;
  sentiment?: number;
}

function sanitizeJsonText(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function toNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(-1, Math.min(1, Number(numeric.toFixed(3))));
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
    `당신은 글로벌 여론 분석가입니다.`,
    `${regionNameKo} (${regionNameEn}) 리전의 핫 토픽 데이터를 간결하게 정리하세요.`,
    `입력 토픽과 동일한 순서/개수로 JSON 배열만 반환해야 합니다.`,
    `각 항목 스키마:`,
    `{ "name_ko": string, "name_en": string, "summary_ko": string, "summary_en": string, "sentiment": number }`,
    `규칙:`,
    `1) summary_ko/summary_en는 각각 1~2문장`,
    `2) sentiment는 -1.0~1.0`,
    `3) 마크다운 금지, 설명 금지`,
    `토픽 입력 JSON:`,
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

  const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
    throw new Error(`Gemini API request failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  if (!text) {
    return topics;
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
      sentiment: toNumber(summary.sentiment, topic.sentiment),
    };
  });
}
