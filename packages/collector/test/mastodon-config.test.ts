import assert from "node:assert/strict";
import test from "node:test";
import { __mastodonTestUtils } from "../src/scrapers/sns/mastodon";

const {
  collectFromInstances,
  parseInstanceList,
  resolveConfiguredInstances,
  resolveMastodonPostsPerInstance,
  resolveMastodonSourcePostCap,
} = __mastodonTestUtils;

const ENV_KEYS = [
  "MASTODON_MAX_INSTANCES",
  "MASTODON_POSTS_PER_INSTANCE",
  "MASTODON_SOURCE_POST_CAP",
  "MASTODON_US_INSTANCES",
  "MASTODON_EU_INSTANCES",
  "MASTODON_KR_INSTANCES",
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

test("parseInstanceList normalizes urls and deduplicates", () => {
  const parsed = parseInstanceList(" mastodon.social,https://mastodon.social/, http://mas.to,invalid@@ ");
  assert.deepEqual(parsed, ["https://mastodon.social", "http://mas.to"]);
});

test("resolveConfiguredInstances only has default fallback for US/EU", () => {
  withEnv(
    {
      MASTODON_MAX_INSTANCES: "2",
      MASTODON_US_INSTANCES: "",
      MASTODON_EU_INSTANCES: "",
      MASTODON_KR_INSTANCES: "",
    },
    () => {
      const us = resolveConfiguredInstances("mastodon_us");
      const eu = resolveConfiguredInstances("mastodon_eu");
      const kr = resolveConfiguredInstances("mastodon_kr");

      assert.deepEqual(us, ["https://mastodon.social"]);
      assert.deepEqual(eu, ["https://mastodon.social", "https://mastodon.world"]);
      assert.deepEqual(kr, []);
    },
  );
});

test("mastodon defaults are set to High-2x profile", () => {
  withEnv({}, () => {
    const instanceList = Array.from({ length: 12 }, (_, index) => `m${index + 1}.example.com`).join(",");
    process.env.MASTODON_US_INSTANCES = instanceList;
    const capped = resolveConfiguredInstances("mastodon_us");

    assert.equal(capped.length, 10);
    assert.equal(resolveMastodonPostsPerInstance(), 70);
    assert.equal(resolveMastodonSourcePostCap(), 70);
  });
});

test("collectFromInstances falls back to trends when local timeline fails", async () => {
  let localCalls = 0;
  let trendsCalls = 0;
  const result = await collectFromInstances({
    sourceId: "mastodon_us",
    instanceBaseUrls: ["https://mastodon.social"],
    headers: { Accept: "application/json" },
    postsPerInstance: 10,
    sourcePostCap: 35,
    fetchClient: {
      async fetchLocalTimeline() {
        localCalls += 1;
        throw new Error("local-failure");
      },
      async fetchTrends() {
        trendsCalls += 1;
        return [
          {
            id: "1001",
            content: "fallback trends post",
            favourites_count: 4,
            replies_count: 1,
            reblogs_count: 2,
            created_at: "2026-01-01T01:00:00.000Z",
            account: {
              acct: "news@mastodon.social",
            },
          },
        ];
      },
    },
  });

  assert.equal(localCalls, 1);
  assert.equal(trendsCalls, 1);
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0]?.externalId, "https://mastodon.social:1001");
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0] ?? "", /local-failure/);
});
