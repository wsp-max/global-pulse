import assert from "node:assert/strict";
import test from "node:test";
import { calculateHeatScoreWithSourceDiversity, type HeatScoreInput } from "../src/heat-score-calculator";

function buildHeatInput(): HeatScoreInput {
  return {
    viewCount: 1200,
    likeCount: 110,
    commentCount: 40,
    dislikeCount: 3,
    hoursSincePosted: 1,
    sourceWeight: 1,
  };
}

test("source diversity multiplier increases heat score for multi-source topic", () => {
  const inputs = [buildHeatInput(), buildHeatInput(), buildHeatInput()];

  const oneSource = calculateHeatScoreWithSourceDiversity(inputs, { sourceDiversityCount: 1 });
  const threeSources = calculateHeatScoreWithSourceDiversity(inputs, { sourceDiversityCount: 3 });
  const eightSources = calculateHeatScoreWithSourceDiversity(inputs, { sourceDiversityCount: 8 });

  assert.ok(threeSources > oneSource);
  assert.ok(eightSources >= threeSources);
  assert.ok(eightSources <= 2000);
});

test("news scope applies fallback heat when engagement metrics are absent", () => {
  const zeroInputs: HeatScoreInput[] = [
    {
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      dislikeCount: 0,
      hoursSincePosted: 0.5,
      sourceWeight: 1,
    },
    {
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      dislikeCount: 0,
      hoursSincePosted: 1.5,
      sourceWeight: 1,
    },
  ];

  const communityHeat = calculateHeatScoreWithSourceDiversity(zeroInputs, {
    sourceDiversityCount: 2,
    scope: "community",
  });
  const newsHeat = calculateHeatScoreWithSourceDiversity(zeroInputs, {
    sourceDiversityCount: 2,
    scope: "news",
  });

  assert.equal(communityHeat, 0);
  assert.ok(newsHeat > 0);
});
