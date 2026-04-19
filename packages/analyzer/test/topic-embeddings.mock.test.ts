import assert from "node:assert/strict";
import test from "node:test";
import type { Topic } from "@global-pulse/shared";
import { enrichTopicsWithEmbeddings } from "../src/topic-embeddings";

const originalFetch = globalThis.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;

function buildTopic(nameEn: string): Topic {
  return {
    regionId: "us",
    nameKo: nameEn,
    nameEn,
    keywords: ["market", "inflation"],
    summaryEn: "Macro topic summary.",
    sentiment: 0,
    heatScore: 100,
    postCount: 5,
    totalViews: 1000,
    totalLikes: 50,
    totalComments: 10,
    sourceIds: ["reddit"],
    periodStart: "2026-04-19T00:00:00.000Z",
    periodEnd: "2026-04-19T01:00:00.000Z",
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.GEMINI_API_KEY = originalGeminiKey;
});

test("enrichTopicsWithEmbeddings keeps original topics when api key is missing", async () => {
  delete process.env.GEMINI_API_KEY;
  const topics = [buildTopic("US Rates"), buildTopic("Oil Market")];
  const enriched = await enrichTopicsWithEmbeddings(topics, { regionId: "us" });

  assert.equal(enriched.length, topics.length);
  assert.equal(enriched[0]?.embeddingJson, undefined);
});

test("enrichTopicsWithEmbeddings maps embedding vectors from batch API", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (!url.includes(":batchEmbedContents")) {
      return new Response("not-found", { status: 404 });
    }

    return new Response(
      JSON.stringify({
        embeddings: [{ values: [0.1, 0.2, 0.3] }, { embedding: { values: [0.4, 0.5, 0.6] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const topics = [buildTopic("US Rates"), buildTopic("Oil Market")];
  const enriched = await enrichTopicsWithEmbeddings(topics, { regionId: "us" });

  assert.deepEqual(enriched[0]?.embeddingJson, [0.1, 0.2, 0.3]);
  assert.deepEqual(enriched[1]?.embeddingJson, [0.4, 0.5, 0.6]);
});
