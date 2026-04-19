import assert from "node:assert/strict";
import test from "node:test";
import type { Topic } from "@global-pulse/shared";
import { mapCrossRegionTopics } from "../src/cross-region-mapper";

function buildTopic(params: {
  id: number;
  regionId: string;
  nameKo: string;
  nameEn: string;
  keywords: string[];
  embedding: number[];
}): Topic {
  return {
    id: params.id,
    regionId: params.regionId,
    nameKo: params.nameKo,
    nameEn: params.nameEn,
    keywords: params.keywords,
    embeddingJson: params.embedding,
    sentiment: 0,
    heatScore: 100,
    postCount: 20,
    totalViews: 3000,
    totalLikes: 200,
    totalComments: 50,
    sourceIds: ["reddit"],
    periodStart: "2026-04-19T00:00:00.000Z",
    periodEnd: "2026-04-19T01:00:00.000Z",
  };
}

test("mapCrossRegionTopics auto-clusters topics when cosine is above auto threshold", () => {
  const topics: Topic[] = [
    buildTopic({
      id: 1,
      regionId: "kr",
      nameKo: "국내 게임 대회",
      nameEn: "Local game tournament",
      keywords: ["fighting game"],
      embedding: [0.9, 0.1, 0.05],
    }),
    buildTopic({
      id: 2,
      regionId: "us",
      nameKo: "북미 e스포츠",
      nameEn: "North America esports",
      keywords: ["esports finals"],
      embedding: [0.88, 0.11, 0.06],
    }),
  ];

  const mapped = mapCrossRegionTopics(topics, { similarityThreshold: 0.24, minRegions: 2 });
  assert.equal(mapped.length, 1);
  assert.deepEqual(mapped[0]?.regions.sort(), ["kr", "us"]);
});

test("mapCrossRegionTopics uses cosine assist zone with lexical score bonus", () => {
  const topics: Topic[] = [
    buildTopic({
      id: 11,
      regionId: "kr",
      nameKo: "반도체 수출 규제",
      nameEn: "Semiconductor export controls",
      keywords: ["chip export", "controls"],
      embedding: [0.7, 0.3, 0.1],
    }),
    buildTopic({
      id: 12,
      regionId: "jp",
      nameKo: "반도체 통제",
      nameEn: "Chip control policy",
      keywords: ["chip policy", "export"],
      embedding: [0.69, 0.28, 0.11],
    }),
  ];

  const mapped = mapCrossRegionTopics(topics, { similarityThreshold: 0.24, minRegions: 2 });
  assert.equal(mapped.length, 1);
});

test("mapCrossRegionTopics does not cluster unrelated low-cosine topics", () => {
  const topics: Topic[] = [
    buildTopic({
      id: 21,
      regionId: "kr",
      nameKo: "야구 경기",
      nameEn: "Baseball match",
      keywords: ["baseball"],
      embedding: [0.9, 0.01, 0.01],
    }),
    buildTopic({
      id: 22,
      regionId: "us",
      nameKo: "금리 회의",
      nameEn: "Interest rate meeting",
      keywords: ["federal reserve"],
      embedding: [0.02, 0.9, 0.03],
    }),
  ];

  const mapped = mapCrossRegionTopics(topics, { similarityThreshold: 0.24, minRegions: 2 });
  assert.equal(mapped.length, 0);
});
