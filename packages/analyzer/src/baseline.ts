export interface HeatStats {
  mean: number;
  std: number;
}

function clampFinite(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

export function computeHeatStats(values: number[]): HeatStats {
  if (values.length === 0) {
    return { mean: 0, std: 0 };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length === 1) {
    return { mean, std: 0 };
  }

  const variance =
    values.reduce((sum, value) => {
      const diff = value - mean;
      return sum + diff * diff;
    }, 0) / values.length;

  return {
    mean: clampFinite(mean),
    std: clampFinite(Math.sqrt(Math.max(variance, 0))),
  };
}

export function calculateAnomalyScore(heatScore: number, baseline: HeatStats | null): number | null {
  if (!baseline || baseline.std <= 0) {
    return null;
  }

  const zScore = (heatScore - baseline.mean) / baseline.std;
  if (!Number.isFinite(zScore)) {
    return null;
  }
  return Number(zScore.toFixed(3));
}
