export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
  controversial: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function normalizeDistribution(values: SentimentDistribution): SentimentDistribution {
  const bounded: SentimentDistribution = {
    positive: clamp(values.positive, 0, 1),
    negative: clamp(values.negative, 0, 1),
    neutral: clamp(values.neutral, 0, 1),
    controversial: clamp(values.controversial, 0, 1),
  };

  const total = bounded.positive + bounded.negative + bounded.neutral + bounded.controversial;
  if (total <= 0) {
    return {
      positive: 0.1,
      negative: 0.1,
      neutral: 0.7,
      controversial: 0.1,
    };
  }

  return {
    positive: Number((bounded.positive / total).toFixed(4)),
    negative: Number((bounded.negative / total).toFixed(4)),
    neutral: Number((bounded.neutral / total).toFixed(4)),
    controversial: Number((bounded.controversial / total).toFixed(4)),
  };
}

export function distributionFromSentiment(sentiment: number | null): SentimentDistribution {
  const value = clamp(sentiment ?? 0, -1, 1);

  if (value >= 0.45) {
    return normalizeDistribution({
      positive: 0.68,
      negative: 0.08,
      neutral: 0.2,
      controversial: 0.04,
    });
  }

  if (value <= -0.45) {
    return normalizeDistribution({
      positive: 0.08,
      negative: 0.68,
      neutral: 0.2,
      controversial: 0.04,
    });
  }

  const controversyBase = 0.12 + Math.max(0, 0.25 - Math.abs(value));
  const positive = 0.24 + value * 0.28;
  const negative = 0.24 - value * 0.28;
  const neutral = 0.4;

  return normalizeDistribution({
    positive,
    negative,
    neutral,
    controversial: controversyBase,
  });
}

export function normalizeSentimentDistribution(
  input: unknown,
  sentiment: number | null,
): SentimentDistribution {
  if (!input || typeof input !== "object") {
    return distributionFromSentiment(sentiment);
  }

  const item = input as Record<string, unknown>;
  const parsed = normalizeDistribution({
    positive: toNumber(item.positive),
    negative: toNumber(item.negative),
    neutral: toNumber(item.neutral),
    controversial: toNumber(item.controversial),
  });

  if (parsed.positive + parsed.negative + parsed.neutral + parsed.controversial <= 0) {
    return distributionFromSentiment(sentiment);
  }

  if (parsed.positive >= 0.28 && parsed.negative >= 0.28) {
    const controversialBoost = Math.min(0.35, Math.sqrt(parsed.positive * parsed.negative) * 0.9);
    return normalizeDistribution({
      positive: parsed.positive,
      negative: parsed.negative,
      neutral: Math.max(0, parsed.neutral - controversialBoost * 0.5),
      controversial: parsed.controversial + controversialBoost,
    });
  }

  return parsed;
}

export function normalizeSentimentReasoning(input: unknown, fallback: string): string {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) {
    return fallback;
  }
  if (text.length <= 60) {
    return text;
  }
  return `${text.slice(0, 57).trimEnd()}...`;
}
