import assert from "node:assert/strict";
import test from "node:test";
import type { Topic } from "@global-pulse/shared";
import { normalizeTopicNamesForStorage } from "../src/topic-name-normalizer";

function buildTopic(overrides: Partial<Topic>): Topic {
  return {
    regionId: "jp",
    nameKo: "기본 이름",
    nameEn: "Base Name",
    keywords: ["alpha", "beta", "gamma"],
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

test("reduces long fragment names to compact phrase labels", () => {
  const topic = buildTopic({
    nameKo: "自由 住民 たちの 雑談 まとめ 緊急",
    nameEn: "someone know where this thing may go",
  });

  const normalized = normalizeTopicNamesForStorage(topic);

  assert.match(normalized.nameKo, /自由|住民/);
  assert.equal(normalized.nameEn, "alpha");
});

test("collapses repeated tokens", () => {
  const topic = buildTopic({
    nameKo: "telega telega update",
    nameEn: "telega telega update",
  });

  const normalized = normalizeTopicNamesForStorage(topic);
  assert.equal(normalized.nameKo.toLowerCase(), "telega update");
  assert.equal(normalized.nameEn.toLowerCase(), "telega update");
});

test("keeps dominant script when ko/en mixed", () => {
  const topic = buildTopic({
    nameKo: "추석 manhwa 분석",
    nameEn: "추석 manhwa 분석",
  });

  const normalized = normalizeTopicNamesForStorage(topic);
  assert.equal(normalized.nameKo, "추석 분석");
});

