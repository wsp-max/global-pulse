import assert from "node:assert/strict";
import test from "node:test";
import type { ScrapedPost } from "@global-pulse/shared";
import { __blueskyTestUtils } from "../src/scrapers/sns/bluesky";

const {
  parseHandleList,
  rankAndCapPosts,
  resolveConfiguredHandles,
  resolveBlueskyMaxHandles,
  resolveBlueskyPostsPerHandle,
  resolveBlueskySourcePostCap,
} = __blueskyTestUtils;

const ENV_KEYS = [
  "BLUESKY_MAX_HANDLES",
  "BLUESKY_POSTS_PER_HANDLE",
  "BLUESKY_SOURCE_POST_CAP",
  "BLUESKY_DEFAULT_HANDLES",
  "BLUESKY_KR_HANDLES",
  "BLUESKY_US_HANDLES",
] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => void): void {
  const snapshot = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    snapshot.set(key, process.env[key]);
  }

  try {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      const prev = snapshot.get(key);
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  }
}

test("parseHandleList normalizes and deduplicates handles", () => {
  const parsed = parseHandleList(" @CNN.COM ,cnn.com, @BBC.com ,, nytimes.com ");
  assert.deepEqual(parsed, ["cnn.com", "bbc.com", "nytimes.com"]);
});

test("resolveConfiguredHandles only uses default fallback for US/EU", () => {
  withEnv(
    {
      BLUESKY_MAX_HANDLES: "2",
      BLUESKY_DEFAULT_HANDLES: "bsky.app,cnn.com,nytimes.com",
      BLUESKY_US_HANDLES: "",
      BLUESKY_KR_HANDLES: "",
    },
    () => {
      const usHandles = resolveConfiguredHandles("bluesky_us");
      const krHandles = resolveConfiguredHandles("bluesky_kr");

      assert.deepEqual(usHandles, ["bsky.app", "cnn.com"]);
      assert.deepEqual(krHandles, []);
    },
  );
});

test("bluesky defaults are set to 3x profile", () => {
  withEnv({}, () => {
    assert.equal(resolveBlueskyMaxHandles(), 36);
    assert.equal(resolveBlueskyPostsPerHandle(), 120);
    assert.equal(resolveBlueskySourcePostCap(), 210);
  });
});

test("rankAndCapPosts applies score sort, recency tie-breaker, and cap", () => {
  const posts: ScrapedPost[] = [
    {
      externalId: "a",
      title: "a",
      likeCount: 10,
      commentCount: 2, // score: 13
      postedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      externalId: "b",
      title: "b",
      likeCount: 12,
      commentCount: 0, // score: 12
      postedAt: "2026-01-03T00:00:00.000Z",
    },
    {
      externalId: "c",
      title: "c",
      likeCount: 10,
      commentCount: 2, // score: 13, newer than a
      postedAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  const ranked = rankAndCapPosts(posts, 2);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]?.externalId, "c");
  assert.equal(ranked[1]?.externalId, "a");
});
