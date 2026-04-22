import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error test runner loads ts source directly via tsx.
import summaryUtils from "../../../lib/utils/topic-summary.ts";

const { buildTopicSummaries } = summaryUtils;

test("buildTopicSummaries keeps existing summaries but tones down evaluative phrasing", () => {
  const result = buildTopicSummaries({
    summaryKo: "OpenAI 관련 논의가 이어지고 있습니다.",
    summaryEn: "OpenAI pricing debate is drawing attention.",
    keywords: ["OpenAI"],
  });

  assert.equal(result.summaryKo, "OpenAI 관련 언급이 이어집니다.");
  assert.equal(result.summaryEn, "OpenAI pricing debate is being discussed.");
});

test("buildTopicSummaries replaces pending summaries with entity-based fallback", () => {
  const result = buildTopicSummaries({
    summaryKo: "요약 준비 중",
    summaryEn: "Summary pending",
    entities: [
      { text: "OpenAI", type: "org" },
      { text: "GPT-5", type: "product" },
      { text: "noise", type: "other" },
    ],
  });

  assert.equal(result.summaryKo, "OpenAI, GPT-5");
  assert.equal(result.summaryEn, "OpenAI, GPT-5");
});

test("buildTopicSummaries uses keyword fallback when no meaningful entities exist", () => {
  const result = buildTopicSummaries({
    summaryKo: null,
    summaryEn: "Summary pending",
    entities: [{ text: "noise", type: "other" }],
    keywords: ["대선", "토론", "여론"],
  });

  assert.equal(result.summaryKo, "대선 · 토론 · 여론");
  assert.equal(result.summaryEn, "대선 · 토론 · 여론");
});

test("buildTopicSummaries falls back to a representative title before keyword phrases", () => {
  const result = buildTopicSummaries({
    summaryKo: "",
    summaryEn: "",
    sampleTitles: ['"대표 기사 제목이 길게 들어오는 경우를 위한 샘플"'],
  });

  assert.equal(result.summaryKo, "대표 기사 제목이 길게 들어오는 경우를 위한 샘플");
  assert.equal(result.summaryEn, "대표 기사 제목이 길게 들어오는 경우를 위한 샘플");
});

test("buildTopicSummaries uses a compact fallback when no signals are available", () => {
  const result = buildTopicSummaries({
    summaryKo: "요약 준비 중",
    summaryEn: "Summary pending",
    nameKo: "미상 토픽",
  });

  assert.equal(result.summaryKo, "미상 토픽");
  assert.equal(result.summaryEn, "미상 토픽");
});

test("buildTopicSummaries rebuilds stored meta summaries from representative titles", () => {
  const result = buildTopicSummaries({
    summaryKo: "현재 게시글에서는 cortis · redred · pro 키워드가 함께 언급된다.",
    summaryEn: "Current posts mention the keywords cortis · redred · pro together.",
    sampleTitles: ["CORTIS (코르티스) 'REDRED' Official MV"],
    keywords: ["cortis", "redred", "pro"],
  });

  assert.equal(result.summaryKo, "CORTIS (코르티스) 'REDRED' Official MV");
  assert.equal(result.summaryEn, "CORTIS (코르티스) 'REDRED' Official MV");
});
