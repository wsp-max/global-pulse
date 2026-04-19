import assert from "node:assert/strict";
import test from "node:test";
import type { GlobalTopic } from "@global-pulse/shared";
import { applyPropagationMetrics, type GlobalTopicHistoryPoint } from "../src/propagation-metrics";

function buildGlobalTopic(): GlobalTopic {
  return {
    id: 1,
    nameEn: "Chip export controls",
    nameKo: "반도체 수출 통제",
    regions: ["kr", "jp"],
    regionalSentiments: { kr: -0.2, jp: -0.1 },
    regionalHeatScores: { kr: 600, jp: 300 },
    topicIds: [10, 11],
    totalHeatScore: 900,
    firstSeenRegion: "kr",
    firstSeenAt: "2026-04-19T00:00:00.000Z",
    propagationTimeline: [
      { regionId: "kr", firstPostAt: "2026-04-19T00:00:00.000Z", heatAtDiscovery: 500 },
      { regionId: "jp", firstPostAt: "2026-04-19T02:00:00.000Z", heatAtDiscovery: 280 },
    ],
  };
}

test("applyPropagationMetrics computes velocity/acceleration/spread and edges", () => {
  const topics = [buildGlobalTopic()];
  const history: GlobalTopicHistoryPoint[] = [
    {
      nameEn: "Chip export controls",
      nameKo: "반도체 수출 통제",
      totalHeatScore: 500,
      regionalHeatScores: { kr: 350, jp: 150 },
      createdAt: "2026-04-18T22:00:00.000Z",
    },
    {
      nameEn: "Chip export controls",
      nameKo: "반도체 수출 통제",
      totalHeatScore: 650,
      regionalHeatScores: { kr: 430, jp: 220 },
      createdAt: "2026-04-18T23:00:00.000Z",
    },
  ];

  const applied = applyPropagationMetrics(topics, history, "2026-04-19T00:00:00.000Z");
  const item = applied[0];
  assert.ok(item);
  assert.equal(typeof item?.velocityPerHour, "number");
  assert.equal(typeof item?.acceleration, "number");
  assert.equal(typeof item?.spreadScore, "number");
  assert.equal(item?.propagationEdges?.length, 1);
  assert.equal(item?.propagationEdges?.[0]?.lagMinutes, 120);
  assert.equal(typeof item?.propagationTimeline?.[0]?.status, "string");
});
