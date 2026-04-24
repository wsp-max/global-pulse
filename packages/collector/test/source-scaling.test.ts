import assert from "node:assert/strict";
import test from "node:test";
import {
  isRedditSourceId,
  resolveCollectorDisableRedditDefault,
  resolveCollectorSourceCap,
  resolveCollectorSourceIntervalMinutes,
} from "../src/utils/source-scaling";

const ENV_KEYS = [
  "COLLECTOR_DISABLE_REDDIT_DEFAULT",
  "COLLECTOR_NON_REDDIT_CAP_MULTIPLIER",
  "COLLECTOR_NON_REDDIT_INTERVAL_SCALE",
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

test("isRedditSourceId detects reddit-prefixed IDs", () => {
  assert.equal(isRedditSourceId("reddit_worldnews"), true);
  assert.equal(isRedditSourceId("  REDDIT_news "), true);
  assert.equal(isRedditSourceId("hackernews"), false);
});

test("resolveCollectorSourceCap applies multiplier only for non-reddit", () => {
  withEnv({ COLLECTOR_NON_REDDIT_CAP_MULTIPLIER: "3" }, () => {
    assert.equal(resolveCollectorSourceCap("hackernews", 30), 90);
    assert.equal(resolveCollectorSourceCap("fourchan", 50), 150);
    assert.equal(resolveCollectorSourceCap("reddit_worldnews", 30), 30);
  });
});

test("resolveCollectorSourceIntervalMinutes scales only non-reddit interval", () => {
  withEnv({ COLLECTOR_NON_REDDIT_INTERVAL_SCALE: "0.34" }, () => {
    assert.equal(resolveCollectorSourceIntervalMinutes("hackernews", 30), 10);
    assert.equal(resolveCollectorSourceIntervalMinutes("dcinside", 15), 5);
    assert.equal(resolveCollectorSourceIntervalMinutes("reddit_news", 30), 30);
  });
});

test("COLLECTOR_DISABLE_REDDIT_DEFAULT defaults to true", () => {
  withEnv({}, () => {
    assert.equal(resolveCollectorDisableRedditDefault(), true);
  });
  withEnv({ COLLECTOR_DISABLE_REDDIT_DEFAULT: "false" }, () => {
    assert.equal(resolveCollectorDisableRedditDefault(), false);
  });
});
