export interface HeatScoreInput {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  dislikeCount: number;
  hoursSincePosted: number;
  sourceWeight: number;
}

interface HeatScoreOptions {
  sourceDiversityCount?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
}

export function calculateHeatScore(items: HeatScoreInput[]): number {
  const rawTotal = items.reduce((sum, item) => {
    const viewComponent = Math.log1p(safeCount(item.viewCount)) * 3.5;
    const likeComponent = Math.log1p(safeCount(item.likeCount)) * 26;
    const commentComponent = Math.log1p(safeCount(item.commentCount)) * 30;
    const dislikeComponent = Math.log1p(safeCount(item.dislikeCount)) * 14;
    const postWeight = viewComponent + likeComponent + commentComponent + dislikeComponent;

    const hours = Number.isFinite(item.hoursSincePosted) ? Math.max(0, item.hoursSincePosted) : 0;
    const timeDecay = Math.exp(-0.1 * hours);
    const sourceWeight = Number.isFinite(item.sourceWeight) ? Math.max(0.1, item.sourceWeight) : 1;
    return sum + postWeight * timeDecay * sourceWeight;
  }, 0);

  if (rawTotal <= 0) {
    return 0;
  }

  // Soft-cap keeps ranking differences in high-volume ranges instead of flattening to 2000.
  const normalized = 2000 * (1 - Math.exp(-rawTotal / 900));
  return clamp(normalized, 0, 2000);
}

function sourceDiversityMultiplier(sourceCount: number): number {
  const safeCount = Number.isFinite(sourceCount) ? Math.max(1, sourceCount) : 1;
  return Math.min(1 + Math.log2(safeCount), 2.2);
}

export function calculateHeatScoreWithSourceDiversity(
  items: HeatScoreInput[],
  options: HeatScoreOptions = {},
): number {
  const base = calculateHeatScore(items);
  const diversity = sourceDiversityMultiplier(options.sourceDiversityCount ?? 1);
  return clamp(base * diversity, 0, 2000);
}

