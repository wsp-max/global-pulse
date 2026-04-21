import assert from "node:assert/strict";
import test from "node:test";
import type { Topic } from "@global-pulse/shared";
import { normalizeTopicNamesForStorage } from "../src/topic-name-normalizer";

function buildTopic(overrides: Partial<Topic>): Topic {
  return {
    regionId: "jp",
    nameKo: "\uae30\ubcf8 \uc774\uc288",
    nameEn: "Base topic",
    summaryKo: "\uae30\ubcf8 \uc774\uc288\ub97c \uc124\uba85\ud558\ub294 \uae34 \uc694\uc57d\uc785\ub2c8\ub2e4.",
    summaryEn: "A longer baseline summary explains the current issue in more detail.",
    keywords: ["dragon ball", "game reveal", "bandai namco"],
    sentiment: 0,
    heatScore: 100,
    postCount: 10,
    totalViews: 1000,
    totalLikes: 100,
    totalComments: 50,
    sourceIds: ["reddit"],
    periodStart: "2026-04-20T00:00:00.000Z",
    periodEnd: "2026-04-20T01:00:00.000Z",
    ...overrides,
  };
}

test("expands short labels into neutral event titles from summary evidence", () => {
  const topic = buildTopic({
    nameKo: "\ub4dc\ub798\uace4\ubcfc",
    nameEn: "Dragon Ball",
    summaryKo: "\ub4dc\ub798\uace4\ubcfc \uc2e0\uc791 \uac8c\uc784 \uacf5\uac1c \uc774\ud6c4 \ud32c\ub364\uc5d0\uc11c \ubcf5\uadc0 \uae30\ub300\uc640 \uc804\ud22c \uc2dc\uc2a4\ud15c \ubd84\uc11d\uc774 \uc5b8\uae09\ub418\uace0 \uc788\uc2b5\ub2c8\ub2e4.",
    summaryEn:
      "Discussion around a new Dragon Ball game reveal accelerated after the first trailer dropped. Fans are focusing on the comeback angle and battle system changes.",
  });

  const normalized = normalizeTopicNamesForStorage(topic);

  assert.equal(normalized.nameKo, "\ub4dc\ub798\uace4\ubcfc \uc2e0\uc791 \uac8c\uc784 \uacf5\uac1c");
  assert.equal(normalized.nameEn, "New Dragon Ball game reveal");
});

test("builds conservative neutral titles from entity and keyword evidence", () => {
  const topic = buildTopic({
    nameKo: "\ub2cc\ud150\ub3c4",
    nameEn: "Nintendo",
    summaryKo: null,
    summaryEn: null,
    entities: [{ text: "Nintendo Switch 2", type: "product" }],
    keywords: ["launch timing", "price debate", "supply outlook"],
  });

  const normalized = normalizeTopicNamesForStorage(topic);

  assert.equal(normalized.nameKo, "Nintendo Switch 2 관련 이슈");
  assert.equal(normalized.nameEn, "Nintendo Switch 2 launch timing");
});

test("keeps existing neutral event names instead of inflating them into sentences", () => {
  const topic = buildTopic({
    nameKo: "\ubbf8\uad6d \uad00\uc138 \uc778\uc0c1 \ub17c\uc758",
    nameEn: "US Tariff Increase Debate",
    summaryKo: "\ucd94\uac00 \uad00\uc138 \uc778\uc0c1 \uac00\ub2a5\uc131\uc774 \uc81c\uae30\ub418\uba74\uc11c \uc218\uc785 \ubb3c\uac00\uc640 \uacf5\uae09\ub9dd \uc601\ud5a5\uc774 \ud568\uaed8 \uc5b8\uae09\ub429\ub2c8\ub2e4.",
    summaryEn: null,
  });

  const normalized = normalizeTopicNamesForStorage(topic);

  assert.equal(normalized.nameKo, "\ubbf8\uad6d \uad00\uc138 \uc778\uc0c1 \ub17c\uc758");
  assert.equal(normalized.nameEn, "US Tariff Increase Debate");
});
