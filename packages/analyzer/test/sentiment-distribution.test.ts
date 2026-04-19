import test from "node:test";
import assert from "node:assert/strict";
import { distributionFromSentiment, normalizeSentimentDistribution } from "../src/sentiment";

test("distributionFromSentiment favors positive when sentiment is positive", () => {
  const result = distributionFromSentiment(0.7);
  assert.ok(result.positive > result.negative);
  assert.ok(result.positive > result.neutral);
});

test("normalizeSentimentDistribution normalizes ratios and boosts controversial when both sides are high", () => {
  const result = normalizeSentimentDistribution(
    { positive: 0.4, negative: 0.4, neutral: 0.2, controversial: 0.0 },
    0,
  );

  assert.ok(result.controversial > 0);
  const total = result.positive + result.negative + result.neutral + result.controversial;
  assert.ok(total > 0.99 && total < 1.01);
});
