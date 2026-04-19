import test from "node:test";
import assert from "node:assert/strict";
import { calculateAnomalyScore, computeHeatStats } from "../src/baseline";

test("computeHeatStats returns zero std for single value", () => {
  const stats = computeHeatStats([120]);
  assert.equal(stats.mean, 120);
  assert.equal(stats.std, 0);
});

test("calculateAnomalyScore returns z-score rounded to 3 decimals", () => {
  const score = calculateAnomalyScore(180, { mean: 120, std: 20 });
  assert.equal(score, 3);
});
