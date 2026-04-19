import assert from "node:assert/strict";
import test from "node:test";
import type { Topic } from "@global-pulse/shared";
import { summarizeTopicsWithGemini } from "../src/gemini-summarizer";

const originalFetch = globalThis.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalBatchSize = process.env.ANALYZER_LLM_CANONICAL_BATCH;

function buildTopic(nameKo: string, nameEn: string): Topic {
  return {
    regionId: "kr",
    nameKo,
    nameEn,
    keywords: ["street fighter", "tournament"],
    sampleTitles: ["Street Fighter 6 tournament", "Capcom cup highlights"],
    sentiment: 0,
    heatScore: 120,
    postCount: 10,
    totalViews: 1000,
    totalLikes: 120,
    totalComments: 40,
    sourceIds: ["reddit"],
    periodStart: "2026-04-19T00:00:00.000Z",
    periodEnd: "2026-04-19T01:00:00.000Z",
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.GEMINI_API_KEY = originalGeminiKey;
  process.env.ANALYZER_LLM_CANONICAL_BATCH = originalBatchSize;
});

test("summarizeTopicsWithGemini falls back to lexical data when api key is missing", async () => {
  delete process.env.GEMINI_API_KEY;
  const topics = [buildTopic("스트리트 파이터", "Street Fighter")];
  const summarized = await summarizeTopicsWithGemini(topics, { regionId: "kr" });

  assert.equal(summarized.length, 1);
  assert.equal(summarized[0]?.nameKo, "스트리트 파이터");
  assert.equal(summarized[0]?.nameEn, "Street Fighter");
  assert.equal(typeof summarized[0]?.canonicalKey, "string");
});

test("summarizeTopicsWithGemini maps category/entities/aliases from gemini response", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.ANALYZER_LLM_CANONICAL_BATCH = "1";

  let generateCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes(":generateContent")) {
      generateCalls += 1;
      const payload = [
        {
          name_ko: "스트리트 파이터 대회",
          name_en: "Street Fighter Tournament",
          summary_ko: "격투 게임 대회 이슈가 확산 중이다.",
          summary_en: "Fighting game tournament buzz is spreading.",
          sentiment: 0.3,
          category: "entertainment",
          entities: [{ text: "Street Fighter", type: "work" }],
          aliases: ["스파 대회"],
        },
        {
          name_ko: "캡콤 컵",
          name_en: "Capcom Cup",
          summary_ko: "캡콤 컵 관련 화제가 증가했다.",
          summary_en: "Capcom Cup mentions are increasing.",
          sentiment: 0.1,
          category: "sports",
          entities: [{ text: "Capcom", type: "org" }],
          aliases: ["Capcom tournament"],
        },
      ];

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify(payload),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/models")) {
      return new Response(
        JSON.stringify({
          models: [
            {
              name: "models/gemini-2.0-flash",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("not-found", { status: 404 });
  };

  const topics = [buildTopic("스트리트 파이터", "Street Fighter"), buildTopic("캡콤 컵", "Capcom Cup")];
  const summarized = await summarizeTopicsWithGemini(topics, { regionId: "kr" });

  assert.equal(summarized.length, 2);
  assert.equal(summarized[0]?.category, "entertainment");
  assert.equal(summarized[0]?.entities?.[0]?.text, "Street Fighter");
  assert.equal(summarized[0]?.aliases?.[0], "스파 대회");
  assert.equal(summarized[1]?.category, "sports");
  assert.equal(typeof summarized[1]?.canonicalKey, "string");
});
