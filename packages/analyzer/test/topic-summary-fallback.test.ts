import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error test runner loads ts source directly via tsx.
import summaryUtils from "../../../lib/utils/topic-summary.ts";

const { buildTopicSummaries } = summaryUtils;

test("buildTopicSummaries keeps existing summaries but tones down evaluative phrasing", () => {
  const result = buildTopicSummaries({
    summaryKo: "OpenAI \uad00\ub828 \ub17c\uc758\uac00 \uc774\uc5b4\uc9c0\uace0 \uc788\uc2b5\ub2c8\ub2e4.",
    summaryEn: "OpenAI pricing debate is drawing attention.",
    keywords: ["OpenAI"],
  });

  assert.equal(result.summaryKo, "OpenAI \uad00\ub828 \uc5b8\uae09\uc774 \uc774\uc5b4\uc9d1\ub2c8\ub2e4.");
  assert.equal(result.summaryEn, "OpenAI pricing debate is being discussed.");
});

test("buildTopicSummaries replaces pending summaries with entity-based fallback", () => {
  const result = buildTopicSummaries({
    summaryKo: "\uc694\uc57d \uc900\ube44 \uc911",
    summaryEn: "Summary pending",
    entities: [
      { text: "OpenAI", type: "org" },
      { text: "GPT-5", type: "product" },
      { text: "noise", type: "other" },
    ],
  });

  assert.equal(result.summaryKo, "\ud604\uc7ac \uc218\uc9d1\ub41c \ubc18\uc751\uc5d0\uc11c\ub294 OpenAI, GPT-5\uc774(\uac00) \ud568\uaed8 \uc5b8\uae09\ub41c\ub2e4.");
  assert.equal(result.summaryEn, "Current coverage mentions OpenAI, GPT-5 together in this issue.");
});

test("buildTopicSummaries uses keyword fallback when no meaningful entities exist", () => {
  const result = buildTopicSummaries({
    summaryKo: null,
    summaryEn: "Summary pending",
    entities: [{ text: "noise", type: "other" }],
    keywords: ["\ub300\uc120", "\ud1a0\ub860", "\uc5ec\ub860"],
  });

  assert.equal(result.summaryKo, "\ud604\uc7ac \uac8c\uc2dc\uae00\uc5d0\uc11c\ub294 \ub300\uc120 \u00b7 \ud1a0\ub860 \u00b7 \uc5ec\ub860 \ud0a4\uc6cc\ub4dc\uac00 \ud568\uaed8 \uc5b8\uae09\ub41c\ub2e4.");
  assert.equal(result.summaryEn, "Current posts mention the keywords 대선 · 토론 · 여론 together.");
});

test("buildTopicSummaries falls back to a representative title before the safe fallback", () => {
  const result = buildTopicSummaries({
    summaryKo: "",
    summaryEn: "",
    sampleTitles: ['"\ub300\ud45c \uae30\uc0ac \uc81c\ubaa9\uc774 \uae38\uac8c \ub4e4\uc5b4\uc624\ub294 \uacbd\uc6b0\ub97c \uc704\ud55c \uc0d8\ud50c"'],
  });

  assert.equal(
    result.summaryKo,
    '\ub300\ud45c \uc81c\ubaa9\uc5d0\uc11c\ub294 "\ub300\ud45c \uae30\uc0ac \uc81c\ubaa9\uc774 \uae38\uac8c \ub4e4\uc5b4\uc624\ub294 \uacbd\uc6b0\ub97c \uc704\ud55c \uc0d8\ud50c" \ub0b4\uc6a9\uc774 \uc5b8\uae09\ub41c\ub2e4.',
  );
  assert.equal(
    result.summaryEn,
    'A representative title references "\ub300\ud45c \uae30\uc0ac \uc81c\ubaa9\uc774 \uae38\uac8c \ub4e4\uc5b4\uc624\ub294 \uacbd\uc6b0\ub97c \uc704\ud55c \uc0d8\ud50c".',
  );
});

test("buildTopicSummaries uses a safe factual fallback when no signals are available", () => {
  const result = buildTopicSummaries({
    summaryKo: "\uc694\uc57d \uc900\ube44 \uc911",
    summaryEn: "Summary pending",
    nameKo: "\ubbf8\uc0c1 \ud1a0\ud53d",
  });

  assert.equal(result.summaryKo, "\ubbf8\uc0c1 \ud1a0\ud53d\uacfc \uad00\ub828\ub41c \uac8c\uc2dc\uae00\uc744 \uae30\ubc18\uc73c\ub85c \uc694\uc57d\uc744 \uad6c\uc131 \uc911\uc774\ub2e4.");
  assert.equal(result.summaryEn, "A summary is being prepared from collected posts related to 미상 토픽.");
});
