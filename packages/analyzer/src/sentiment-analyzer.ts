const POSITIVE_KEYWORDS = [
  "good",
  "great",
  "success",
  "win",
  "positive",
  "best",
  "awesome",
  "happy",
  "improve",
  "상승",
  "성공",
  "호재",
  "좋다",
  "긍정",
  "승리",
  "기대",
];

const NEGATIVE_KEYWORDS = [
  "bad",
  "fail",
  "crisis",
  "negative",
  "loss",
  "worst",
  "angry",
  "decline",
  "risk",
  "하락",
  "실패",
  "악재",
  "부정",
  "논란",
  "위기",
  "사고",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function analyzeSentiment(text: string): number {
  const lowered = text.toLowerCase();

  let score = 0;
  for (const word of POSITIVE_KEYWORDS) {
    if (lowered.includes(word)) score += 0.15;
  }
  for (const word of NEGATIVE_KEYWORDS) {
    if (lowered.includes(word)) score -= 0.15;
  }

  return clamp(score, -1, 1);
}

