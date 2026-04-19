function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface HeatBandOptions {
  min?: number;
  max?: number;
}

export function toHeatBand(score: number, max: number, options: HeatBandOptions = {}): number {
  const min = Number.isFinite(options.min) ? (options.min as number) : 0;
  const maxClamp = Number.isFinite(options.max) ? (options.max as number) : 1;
  const safeScore = Math.max(0, Number.isFinite(score) ? score : 0);
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 1);
  const numerator = Math.log10(1 + safeScore);
  const denominator = Math.log10(1 + safeMax);

  if (denominator <= 0) {
    return 0;
  }

  return clamp(numerator / denominator, min, maxClamp);
}

export function toHeatPercent(score: number, max: number, minPercent = 6): number {
  const band = toHeatBand(score, max);
  return clamp(Math.round(band * 100), minPercent, 100);
}

export type HeatTier = "low" | "mid" | "high";

export function getHeatTier(band: number): HeatTier {
  if (band < 0.35) {
    return "low";
  }
  if (band < 0.72) {
    return "mid";
  }
  return "high";
}
