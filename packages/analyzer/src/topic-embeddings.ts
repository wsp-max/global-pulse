import type { Topic } from "@global-pulse/shared";
import { getLogger } from "@global-pulse/shared/server-logger";

const GEMINI_API_BASE = process.env.GEMINI_API_BASE?.trim() || "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION?.trim() || "v1beta";
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004";
const EMBEDDING_BATCH_SIZE = 100;
const MAX_REQUESTS_PER_SECOND = 10;
const MIN_REQUEST_INTERVAL_MS = Math.ceil(1000 / MAX_REQUESTS_PER_SECOND);

const logger = getLogger("analyzer-embeddings");

interface EmbeddingOptions {
  regionId: string;
}

interface GeminiEmbeddingResponse {
  embeddings?: Array<
    | {
        values?: number[];
      }
    | {
        embedding?: {
          values?: number[];
        };
      }
  >;
}

let lastRequestAt = 0;

function endpointForBatchEmbed(model: string): string {
  return `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models/${model}:batchEmbedContents`;
}

function buildEmbeddingInput(topic: Topic): string {
  const chunks = [
    topic.nameEn,
    topic.nameKo,
    topic.keywords.join(", "),
    topic.summaryEn ?? "",
  ];

  return chunks
    .join("\n")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - now);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestAt = Date.now();
}

function parseEmbeddingValues(item: GeminiEmbeddingResponse["embeddings"] extends Array<infer T> ? T : never): number[] | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const direct = Array.isArray((item as { values?: number[] }).values)
    ? (item as { values: number[] }).values
    : null;
  if (direct) {
    return direct.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }

  const nested = Array.isArray((item as { embedding?: { values?: number[] } }).embedding?.values)
    ? (item as { embedding: { values: number[] } }).embedding.values
    : null;
  if (!nested) {
    return null;
  }

  return nested.map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

async function requestBatchEmbeddings(apiKey: string, texts: string[]): Promise<number[][] | null> {
  await waitForRateLimit();

  const response = await fetch(`${endpointForBatchEmbed(GEMINI_EMBEDDING_MODEL)}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: {
          parts: [{ text }],
        },
      })),
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;
  if (!Array.isArray(data.embeddings) || data.embeddings.length === 0) {
    return null;
  }

  const vectors: number[][] = [];
  for (const embedding of data.embeddings) {
    const values = parseEmbeddingValues(embedding);
    vectors.push(values ?? []);
  }
  return vectors;
}

export async function enrichTopicsWithEmbeddings(topics: Topic[], options: EmbeddingOptions): Promise<Topic[]> {
  if (topics.length === 0) {
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return topics;
  }

  const startedAt = Date.now();
  let requestCount = 0;
  let fallbackBatches = 0;
  const enriched = [...topics];

  for (let cursor = 0; cursor < topics.length; cursor += EMBEDDING_BATCH_SIZE) {
    const batchTopics = topics.slice(cursor, cursor + EMBEDDING_BATCH_SIZE);
    const texts = batchTopics.map((topic) => buildEmbeddingInput(topic));
    requestCount += 1;
    const vectors = await requestBatchEmbeddings(apiKey, texts);

    if (!vectors) {
      fallbackBatches += 1;
      continue;
    }

    for (let index = 0; index < batchTopics.length; index += 1) {
      const vector = vectors[index] ?? null;
      const normalizedVector = Array.isArray(vector) && vector.length > 0 ? vector : null;
      enriched[cursor + index] = {
        ...enriched[cursor + index],
        embeddingJson: normalizedVector,
      };
    }
  }

  logger.info(
    `[${options.regionId}] embedding enrichment done topics=${topics.length} calls=${requestCount} fallbacks=${fallbackBatches} durationMs=${Date.now() - startedAt}`,
  );

  return enriched;
}
