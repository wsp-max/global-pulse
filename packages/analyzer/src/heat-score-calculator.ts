export interface HeatScoreInput {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  dislikeCount: number;
  hoursSincePosted: number;
  sourceWeight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateHeatScore(items: HeatScoreInput[]): number {
  const total = items.reduce((sum, item) => {
    const postWeight =
      item.viewCount * 0.1 +
      item.likeCount * 2.0 +
      item.commentCount * 1.5 +
      item.dislikeCount * 0.5;

    const timeDecay = Math.exp(-0.1 * item.hoursSincePosted);
    return sum + postWeight * timeDecay * item.sourceWeight;
  }, 0);

  return clamp(total, 0, 2000);
}

