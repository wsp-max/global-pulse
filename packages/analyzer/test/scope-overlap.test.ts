import assert from "node:assert/strict";
import test from "node:test";
import type { Topic, TopicEntity } from "@global-pulse/shared";
import { detectScopeOverlaps, type ScopeOverlapCandidate } from "../src/scope-overlap";

function buildTopic(params: {
  id: number;
  scope: "community" | "news";
  nameEn: string;
  keywords: string[];
  embedding: number[];
  canonicalKey?: string | null;
  firstPostAt?: string;
  entities?: TopicEntity[];
}): ScopeOverlapCandidate {
  return {
    id: params.id,
    regionId: "us",
    nameKo: params.nameEn,
    nameEn: params.nameEn,
    keywords: params.keywords,
    embeddingJson: params.embedding,
    canonicalKey: params.canonicalKey,
    entities: params.entities,
    sentiment: 0,
    heatScore: 100,
    postCount: 10,
    totalViews: 100,
    totalLikes: 10,
    totalComments: 2,
    sourceIds: [params.scope === "community" ? "reddit" : "news"],
    scope: params.scope,
    periodStart: "2026-04-19T00:00:00.000Z",
    periodEnd: "2026-04-19T01:00:00.000Z",
    firstPostAt: params.firstPostAt ?? "2026-04-19T00:00:00.000Z",
  } satisfies Topic & { firstPostAt: string };
}

test("detectScopeOverlaps ignores placeholder canonical-only matches", () => {
  const overlaps = detectScopeOverlaps(
    [
      buildTopic({
        id: 1,
        scope: "community",
        nameEn: "Baseball trade rumors",
        keywords: ["baseball"],
        embedding: [1, 0, 0],
        canonicalKey: "globalTopic1",
      }),
    ],
    [
      buildTopic({
        id: 2,
        scope: "news",
        nameEn: "Central bank rate decision",
        keywords: ["interest rates"],
        embedding: [0, 1, 0],
        canonicalKey: "globalTopic1",
      }),
    ],
  );

  assert.equal(overlaps.length, 0);
});

test("detectScopeOverlaps rejects low-cosine pairs without lexical evidence", () => {
  const overlaps = detectScopeOverlaps(
    [
      buildTopic({
        id: 11,
        scope: "community",
        nameEn: "Console launch discussion",
        keywords: ["console launch"],
        embedding: [0.8, 0.2, 0],
      }),
    ],
    [
      buildTopic({
        id: 12,
        scope: "news",
        nameEn: "Oil price outlook",
        keywords: ["energy market"],
        embedding: [0.2, 0.8, 0],
      }),
    ],
  );

  assert.equal(overlaps.length, 0);
});

test("detectScopeOverlaps accepts assist-cosine pairs with shared lexical evidence", () => {
  const overlaps = detectScopeOverlaps(
    [
      buildTopic({
        id: 21,
        scope: "community",
        nameEn: "Semiconductor export control debate",
        keywords: ["chip export", "semiconductor controls"],
        embedding: [0.82, 0.48, 0.3],
        firstPostAt: "2026-04-19T00:00:00.000Z",
      }),
    ],
    [
      buildTopic({
        id: 22,
        scope: "news",
        nameEn: "Chip export control policy",
        keywords: ["chip export", "policy controls"],
        embedding: [0.78, 0.5, 0.35],
        firstPostAt: "2026-04-19T00:45:00.000Z",
      }),
    ],
    { autoCosineThreshold: 0.95, cosineThreshold: 0.82 },
  );

  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0]?.communityTopicId, 21);
  assert.equal(overlaps[0]?.newsTopicId, 22);
  assert.equal(overlaps[0]?.leader, "community");
});

test("detectScopeOverlaps greedily keeps the best one-to-one pair", () => {
  const overlaps = detectScopeOverlaps(
    [
      buildTopic({
        id: 31,
        scope: "community",
        nameEn: "AI chip export controls",
        keywords: ["ai chip", "export controls"],
        embedding: [0.92, 0.25, 0.1],
      }),
      buildTopic({
        id: 32,
        scope: "community",
        nameEn: "Chip policy roundup",
        keywords: ["chip policy"],
        embedding: [0.86, 0.3, 0.1],
      }),
    ],
    [
      buildTopic({
        id: 33,
        scope: "news",
        nameEn: "AI chip export controls",
        keywords: ["ai chip", "export controls"],
        embedding: [0.91, 0.26, 0.1],
      }),
    ],
  );

  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0]?.communityTopicId, 31);
  assert.equal(overlaps[0]?.newsTopicId, 33);
});
