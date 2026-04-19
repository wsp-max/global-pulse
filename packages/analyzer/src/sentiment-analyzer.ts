const POSITIVE_TERMS = [
  "good",
  "great",
  "success",
  "win",
  "positive",
  "best",
  "awesome",
  "happy",
  "improve",
  "growth",
  "bullish",
  "support",
  "liked",
  "love",
  "흥행",
  "호재",
  "성공",
  "개선",
  "좋다",
  "긍정",
  "상승",
  "好評",
  "成功",
  "改善",
  "上昇",
  "勝利",
];

const NEGATIVE_TERMS = [
  "bad",
  "fail",
  "crisis",
  "negative",
  "loss",
  "worst",
  "angry",
  "decline",
  "risk",
  "bearish",
  "drop",
  "fraud",
  "hate",
  "하락",
  "악재",
  "실패",
  "문제",
  "부정",
  "위기",
  "손실",
  "悪化",
  "失敗",
  "下落",
  "危機",
  "炎上",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countMatches(text: string, terms: string[]): number {
  return terms.reduce((count, term) => {
    if (!term) {
      return count;
    }
    return text.includes(term) ? count + 1 : count;
  }, 0);
}

export function analyzeSentiment(text: string): number | null {
  const normalized = text.normalize("NFKC").toLowerCase();
  if (!normalized.trim()) {
    return null;
  }

  const positiveCount = countMatches(normalized, POSITIVE_TERMS);
  const negativeCount = countMatches(normalized, NEGATIVE_TERMS);
  const totalSignals = positiveCount + negativeCount;

  if (totalSignals === 0) {
    return null;
  }

  let score = (positiveCount - negativeCount) / totalSignals;
  if (normalized.includes("!")) {
    score += score >= 0 ? 0.05 : -0.05;
  }

  return Number(clamp(score, -1, 1).toFixed(3));
}
