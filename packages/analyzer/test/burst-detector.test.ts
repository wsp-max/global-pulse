import assert from "node:assert/strict";
import test from "node:test";
import { detectKeywordBursts } from "../src/burst-detector";
import type { AnalysisPostInput } from "../src/keyword-extractor";

function buildPost(id: number, title: string, postedAt: string): AnalysisPostInput {
  return {
    id: String(id),
    sourceId: "reddit",
    title,
    viewCount: 10,
    likeCount: 2,
    dislikeCount: 0,
    commentCount: 1,
    postedAt,
    collectedAt: postedAt,
  };
}

test("detectKeywordBursts detects recent surge with z-score and boost", () => {
  const endAt = new Date("2026-04-19T12:00:00.000Z");
  const posts: AnalysisPostInput[] = [];
  let id = 1;

  for (let hour = 2; hour <= 25; hour += 1) {
    posts.push(
      buildPost(
        id++,
        "earthquake bulletin",
        new Date(endAt.getTime() - hour * 60 * 60 * 1000).toISOString(),
      ),
    );
  }

  for (let i = 0; i < 8; i += 1) {
    posts.push(
      buildPost(
        id++,
        "earthquake update",
        new Date(endAt.getTime() - (5 + i) * 60 * 1000).toISOString(),
      ),
    );
  }

  const burstMap = detectKeywordBursts("us", posts, ["earthquake", "sports"], {
    endAtIso: endAt.toISOString(),
    minZ: 2,
  });

  const earthquake = burstMap.get("earthquake");
  assert.ok(earthquake);
  assert.ok((earthquake?.zScore ?? 0) >= 2);
  assert.ok((earthquake?.burstBoost ?? 1) > 1);
  assert.equal(burstMap.has("sports"), false);
});

test("detectKeywordBursts returns empty map when no keywords or posts", () => {
  assert.equal(detectKeywordBursts("kr", [], ["market"]).size, 0);
  assert.equal(
    detectKeywordBursts("kr", [buildPost(1, "market update", "2026-04-19T00:00:00.000Z")], []).size,
    0,
  );
});
