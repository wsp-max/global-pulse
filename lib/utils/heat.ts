function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function toHeatBand(score: number, max: number): number {
  const safeScore = Math.max(0, Number.isFinite(score) ? score : 0);
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 1);
  const numerator = Math.log10(1 + safeScore);
  const denominator = Math.log10(1 + safeMax);

  if (denominator <= 0) {
    return 0;
  }

  return clamp(numerator / denominator, 0, 1);
}

export function toHeatPercent(score: number, max: number, minPercent = 6): number {
  const band = toHeatBand(score, max);
  return clamp(Math.round(band * 100), minPercent, 100);
}
