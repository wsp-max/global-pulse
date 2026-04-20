import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error test runner loads ts source directly via tsx.
import summaryUtils from "../../../lib/utils/topic-summary.ts";

const { buildTopicSummaries } = summaryUtils;

test("buildTopicSummaries keeps existing non-pending summaries", () => {
  const result = buildTopicSummaries({
    summaryKo: "기존 요약입니다.",
    summaryEn: "Existing summary.",
    keywords: ["키워드1"],
  });

  assert.equal(result.summaryKo, "기존 요약입니다.");
  assert.equal(result.summaryEn, "Existing summary.");
});

test("buildTopicSummaries replaces pending summaries with entity-based fallback", () => {
  const result = buildTopicSummaries({
    summaryKo: "요약 준비 중",
    summaryEn: "Summary pending",
    entities: [
      { text: "OpenAI", type: "org" },
      { text: "GPT-5", type: "product" },
      { text: "무의미", type: "other" },
    ],
  });

  assert.equal(result.summaryKo, "OpenAI, GPT-5 관련 반응이 확산되고 있습니다.");
  assert.equal(result.summaryEn, "Discussion around OpenAI, GPT-5 is spreading across regions.");
});

test("buildTopicSummaries uses keyword fallback when no meaningful entities", () => {
  const result = buildTopicSummaries({
    summaryKo: null,
    summaryEn: "Summary pending",
    entities: [{ text: "noise", type: "other" }],
    keywords: ["대선", "토론", "대선"],
  });

  assert.equal(result.summaryKo, "핵심 키워드 대선 · 토론 중심으로 반응이 모이고 있습니다.");
  assert.equal(result.summaryEn, "Signals are converging on keywords: 대선 · 토론.");
});

test("buildTopicSummaries falls back to sample title before safe fallback", () => {
  const result = buildTopicSummaries({
    summaryKo: "",
    summaryEn: "",
    sampleTitles: ['"대표 기사 제목이 길게 들어오는 경우를 위한 샘플"'],
  });

  assert.match(result.summaryKo, /^대표 게시글 "대표 기사 제목이 길게 들어오는 경우를 위한 샘플" 중심으로 반응이 확산되고 있습니다\.$/);
  assert.match(result.summaryEn, /^The discussion is building around "대표 기사 제목이 길게 들어오는 경우를 위한 샘플"\.$/);
});

test("buildTopicSummaries uses safe fallback when no signals are available", () => {
  const result = buildTopicSummaries({
    summaryKo: "요약 준비 중",
    summaryEn: "Summary pending",
    nameKo: "미상 토픽",
  });

  assert.equal(result.summaryKo, "미상 토픽 관련 반응을 집계 중이며 곧 상세 요약이 반영됩니다.");
  assert.equal(
    result.summaryEn,
    "Signals for 미상 토픽 are being aggregated and a detailed summary will be updated shortly.",
  );
});
