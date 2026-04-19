export interface HeatScoreInput {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  dislikeCount: number;
  hoursSincePosted: number;
  sourceWeight: number;
  baselineSignal?: number;
}

interface HeatScoreOptions {
  sourceDiversityCount?: number;
  scope?: "community" | "news" | "mixed";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
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
    const baselineComponent = safeCount(item.baselineSignal) * 22;
    const postWeight = viewComponent + likeComponent + commentComponent + dislikeComponent + baselineComponent;

    const hours = Number.isFinite(item.hoursSincePosted) ? Math.max(0, item.hoursSincePosted) : 0;
    const timeDecay = Math.exp(-0.1 * hours);
    const sourceWeight = Number.isFinite(item.sourceWeight) ? Math.max(0.1, item.sourceWeight) : 1;
    return sum + postWeight * timeDecay * sourceWeight;
  }, 0);

  if (rawTotal <= 0) {
    return 0;
  }

  return Number(rawTotal.toFixed(4));
}

function sourceDiversityMultiplier(sourceCount: number): number {
  const safeCount = Number.isFinite(sourceCount) ? Math.max(1, sourceCount) : 1;
  return Math.min(1 + Math.log2(safeCount), 2.2);
}

function newsFallbackHeat(itemCount: number): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) {
    return 0;
  }
  return clamp(Math.log1p(itemCount) * 120, 40, 420);
}

export function calculateHeatScoreWithSourceDiversity(
  items: HeatScoreInput[],
  options: HeatScoreOptions = {},
): number {
  const base = calculateHeatScore(items);
  const diversity = sourceDiversityMultiplier(options.sourceDiversityCount ?? 1);
  if (base <= 0 && options.scope === "news") {
    return Number((newsFallbackHeat(items.length) * diversity).toFixed(4));
  }
  return Number((base * diversity).toFixed(4));
}

