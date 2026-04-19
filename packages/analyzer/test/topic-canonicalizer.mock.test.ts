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
  const result = await summarizeTopicsWithGemini(topics, { regionId: "kr" });

  assert.equal(result.topics.length, 1);
  assert.equal(result.topics[0]?.nameKo, "스트리트 파이터");
  assert.equal(result.topics[0]?.nameEn, "Street Fighter");
  assert.equal(typeof result.topics[0]?.canonicalKey, "string");
  assert.equal(result.stats.requestCount, 0);
  assert.equal(result.stats.fallbackCount, 1);
  assert.equal(result.stats.errors[0], "no-api-key");
});

test("summarizeTopicsWithGemini maps category/entities/aliases from gemini response", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.ANALYZER_LLM_CANONICAL_BATCH = "1";

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes(":generateContent")) {
      const payload = [
        {
          name_ko: "스트리트 파이터 대회",
          name_en: "Street Fighter Tournament",
          summary_ko:
            "캡콤컵 예선 일정 공개 이후 커뮤니티에서 대회 관전 포인트가 빠르게 확산되고 있습니다. 참가 선수와 대진 분석이 집중적으로 공유되며 기대감이 커지고 있습니다.",
          summary_en:
            "After the Capcom Cup qualifier schedule was announced, discussion around matchups spread quickly across communities. Players and bracket analysis are driving a mostly positive anticipation signal.",
          sentiment: 0.3,
          category: "entertainment",
          entities: [{ text: "Street Fighter", type: "work" }],
          aliases: ["스파 대회"],
        },
        {
          name_ko: "캡콤 컵",
          name_en: "Capcom Cup",
          summary_ko:
            "결승 진출 선수가 확정되면서 캡콤 컵 관련 언급량이 급격히 상승했습니다. 우승 후보 비교와 상금 규모 이슈가 함께 언급되며 관심이 유지되고 있습니다.",
          summary_en:
            "Mentions of Capcom Cup surged after the final roster was confirmed for the finals. Debate over title contenders and prize pool size is sustaining attention with mixed sentiment.",
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
  const result = await summarizeTopicsWithGemini(topics, { regionId: "kr" });

  assert.equal(result.topics.length, 2);
  assert.equal(result.topics[0]?.category, "entertainment");
  assert.equal(result.topics[0]?.entities?.[0]?.text, "Street Fighter");
  assert.equal(result.topics[0]?.aliases?.[0], "스파 대회");
  assert.equal(result.topics[1]?.category, "sports");
  assert.equal(typeof result.topics[1]?.canonicalKey, "string");
  assert.ok(result.stats.requestCount >= 1);
  assert.ok(result.stats.modelUsed.length >= 1);
});

test("summarizeTopicsWithGemini keeps lexical names when gemini returns low-signal labels", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.ANALYZER_LLM_CANONICAL_BATCH = "1";

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes(":generateContent")) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      {
                        name_ko: "오늘 주요 소식",
                        name_en: "Major Related Update",
                        summary_ko:
                          "짧은 요약이 아닌 완성형 문장으로 작성됩니다. 하지만 이름은 저신호 라벨이므로 원래 lexical 이름을 유지해야 합니다.",
                        summary_en:
                          "This output uses complete sentences instead of a short placeholder summary. The model name should still be rejected as low-signal and keep lexical naming.",
                        sentiment: 0,
                        category: "other",
                        entities: [],
                        aliases: [],
                      },
                    ]),
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

  const topics = [buildTopic("스트리트 파이터 대회", "Street Fighter Tournament")];
  const result = await summarizeTopicsWithGemini(topics, { regionId: "kr" });

  assert.equal(result.topics.length, 1);
  assert.equal(result.topics[0]?.nameKo, "스트리트 파이터 대회");
  assert.equal(result.topics[0]?.nameEn, "Street Fighter Tournament");
  assert.ok(result.stats.requestCount >= 1);
});
