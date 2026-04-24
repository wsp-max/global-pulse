import assert from "node:assert/strict";
import test from "node:test";
import type { Topic, TopicEntity } from "@global-pulse/shared";
import { detectScopeOverlaps, isPlaceholderCanonicalKey, type ScopeOverlapCandidate } from "../src/scope-overlap";

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

test("detectScopeOverlaps treats regional placeholder canonical variants as placeholders", () => {
  assert.equal(isPlaceholderCanonicalKey("region jp topic 6"), true);
  assert.equal(isPlaceholderCanonicalKey("regionjptopic6"), true);
  assert.equal(isPlaceholderCanonicalKey("region-jp-topic-6"), true);

  const overlaps = detectScopeOverlaps(
    [
      buildTopic({
        id: 3,
        scope: "community",
        nameEn: "Baseball trade rumors",
        keywords: ["baseball"],
        embedding: [],
        canonicalKey: "region jp topic 6",
      }),
    ],
    [
      buildTopic({
        id: 4,
        scope: "news",
        nameEn: "Central bank rate decision",
        keywords: ["interest rates"],
        embedding: [],
        canonicalKey: "region-jp-topic-6",
      }),
    ],
  );

  assert.equal(overlaps.length, 0);
});

test("detectScopeOverlaps rejects matches supported only by noisy tokens", () => {
  const overlaps = detectScopeOverlaps(
    [
      buildTopic({
        id: 5,
        scope: "community",
        nameEn: "Forum source submitted read thread",
        keywords: ["read", "source", "submitted"],
        embedding: [],
      }),
    ],
    [
      buildTopic({
        id: 6,
        scope: "news",
        nameEn: "Login register current source",
        keywords: ["read", "source", "submitted"],
        embedding: [],
      }),
    ],
  );

  assert.equal(overlaps.length, 0);
});

test("detectScopeOverlaps rejects name-only lexical matches without support", () => {
  const overlaps = detectScopeOverlaps(
    [
      buildTopic({
        id: 7,
        scope: "community",
        nameEn: "Nintendo Switch launch discussion",
        keywords: ["gaming"],
        embedding: [],
      }),
    ],
    [
      buildTopic({
        id: 8,
        scope: "news",
        nameEn: "Nintendo Switch launch timing",
        keywords: ["console"],
        embedding: [],
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

test("detectScopeOverlaps accepts meaningful canonical matches without embeddings", () => {
  const overlaps = detectScopeOverlaps(
    [
      buildTopic({
        id: 25,
        scope: "community",
        nameEn: "Community posts discuss Casa Rosada protests",
        keywords: ["protest"],
        embedding: [],
        canonicalKey: "casa rosada",
      }),
    ],
    [
      buildTopic({
        id: 26,
        scope: "news",
        nameEn: "News reports Casa Rosada protest",
        keywords: ["demonstration"],
        embedding: [],
        canonicalKey: "casa rosada",
      }),
    ],
  );

  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0]?.communityTopicId, 25);
  assert.equal(overlaps[0]?.newsTopicId, 26);
});

test("detectScopeOverlaps accepts strong shared name tokens with keyword support without embeddings", () => {
  const overlaps = detectScopeOverlaps(
    [
      buildTopic({
        id: 27,
        scope: "community",
        nameEn: "Nintendo Switch launch discussion",
        keywords: ["nintendo switch"],
        embedding: [],
      }),
    ],
    [
      buildTopic({
        id: 28,
        scope: "news",
        nameEn: "Nintendo Switch launch timing",
        keywords: ["nintendo switch"],
        embedding: [],
      }),
    ],
  );

  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0]?.communityTopicId, 27);
  assert.equal(overlaps[0]?.newsTopicId, 28);
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
