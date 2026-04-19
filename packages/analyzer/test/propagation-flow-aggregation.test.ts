import assert from "node:assert/strict";
import test from "node:test";
import type { GlobalTopic } from "@global-pulse/shared";
import flowUtils from "../../../lib/utils/propagation-flow.ts";

const { aggregateFlowEdges, getFlowStrokeColor, toVolumeBand } = flowUtils;

function topic(partial: Partial<GlobalTopic>): GlobalTopic {
  return {
    id: partial.id ?? 1,
    nameEn: partial.nameEn ?? "topic-en",
    nameKo: partial.nameKo ?? "토픽",
    summaryEn: partial.summaryEn ?? null,
    summaryKo: partial.summaryKo ?? null,
    regions: partial.regions ?? ["kr", "jp"],
    regionalSentiments: partial.regionalSentiments ?? {},
    regionalHeatScores: partial.regionalHeatScores ?? {},
    topicIds: partial.topicIds ?? [],
    totalHeatScore: partial.totalHeatScore ?? 0,
    firstSeenRegion: partial.firstSeenRegion,
    firstSeenAt: partial.firstSeenAt,
    heatScoreDisplay: partial.heatScoreDisplay ?? null,
    velocityPerHour: partial.velocityPerHour ?? 0,
    acceleration: partial.acceleration ?? null,
    spreadScore: partial.spreadScore ?? 0,
    propagationTimeline: partial.propagationTimeline ?? null,
    propagationEdges: partial.propagationEdges ?? null,
    scope: partial.scope,
  };
}

test("aggregateFlowEdges keeps only one direction for reciprocal pairs", () => {
  const edges = aggregateFlowEdges([
    topic({
      id: 1,
      totalHeatScore: 100,
      propagationEdges: [{ from: "kr", to: "jp", lagMinutes: 180, confidence: 0.5 }],
    }),
    topic({
      id: 2,
      totalHeatScore: 80,
      propagationEdges: [{ from: "jp", to: "kr", lagMinutes: 120, confidence: 1 }],
    }),
  ]);

  assert.equal(edges.length, 1);
  assert.equal(edges[0]?.from, "jp");
  assert.equal(edges[0]?.to, "kr");
});

test("aggregateFlowEdges resolves reciprocal ties by lower lag", () => {
  const edges = aggregateFlowEdges([
    topic({
      id: 3,
      totalHeatScore: 100,
      propagationEdges: [{ from: "us", to: "eu", lagMinutes: 180, confidence: 1 }],
    }),
    topic({
      id: 4,
      totalHeatScore: 100,
      propagationEdges: [{ from: "eu", to: "us", lagMinutes: 60, confidence: 1 }],
    }),
  ]);

  assert.equal(edges.length, 1);
  assert.equal(edges[0]?.from, "eu");
  assert.equal(edges[0]?.to, "us");
  assert.equal(edges[0]?.lagMinutes, 60);
});

test("toVolumeBand and getFlowStrokeColor reflect volume scale", () => {
  const low = toVolumeBand(10, 1_000);
  const high = toVolumeBand(900, 1_000);
  assert.ok(low < high);

  const lowColor = getFlowStrokeColor("community", low);
  const highColor = getFlowStrokeColor("community", high);
  assert.notEqual(lowColor, highColor);
});
