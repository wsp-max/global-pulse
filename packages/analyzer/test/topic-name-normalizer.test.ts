import assert from "node:assert/strict";
import test from "node:test";
import type { Topic } from "@global-pulse/shared";
import { normalizeTopicNamesForStorage } from "../src/topic-name-normalizer";

function buildTopic(overrides: Partial<Topic>): Topic {
  return {
    regionId: "jp",
    nameKo: "기본 이슈",
    nameEn: "Base topic",
    summaryKo: "기본 이슈를 설명하는 긴 요약입니다.",
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
    nameKo: "드래곤볼",
    nameEn: "Dragon Ball",
    summaryKo: "드래곤볼 신작 게임 공개 이후 팬덤에서 복귀 기대와 전투 시스템 분석이 언급되고 있습니다.",
    summaryEn:
      "Discussion around a new Dragon Ball game reveal accelerated after the first trailer dropped. Fans are focusing on the comeback angle and battle system changes.",
  });

  const normalized = normalizeTopicNamesForStorage(topic);

  assert.equal(normalized.nameKo, "드래곤볼 신작 게임 공개");
  assert.equal(normalized.nameEn, "New Dragon Ball game reveal");
});

test("builds conservative neutral titles from entity and keyword evidence", () => {
  const topic = buildTopic({
    nameKo: "닌텐도",
    nameEn: "Nintendo",
    summaryKo: null,
    summaryEn: null,
    entities: [{ text: "Nintendo Switch 2 launch timing", type: "product" }],
    keywords: ["launch timing", "price debate", "supply outlook"],
  });

  const normalized = normalizeTopicNamesForStorage(topic);

  assert.equal(normalized.nameKo, "Nintendo Switch 2 launch timing");
  assert.equal(normalized.nameEn, "Nintendo Switch 2 launch timing");
});

test("keeps existing neutral event names instead of inflating them into sentences", () => {
  const topic = buildTopic({
    nameKo: "미국 관세 인상 논의",
    nameEn: "US Tariff Increase Debate",
    summaryKo: "추가 관세 인상 가능성이 제기되면서 수입 물가와 공급망 영향이 함께 언급됩니다.",
    summaryEn: null,
  });

  const normalized = normalizeTopicNamesForStorage(topic);

  assert.equal(normalized.nameKo, "미국 관세 인상 논의");
  assert.equal(normalized.nameEn, "US Tariff Increase Debate");
});


