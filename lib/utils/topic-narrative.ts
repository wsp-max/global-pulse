export type NarrativeStageKey = "emerging" | "spreading" | "peaking" | "fading";

interface NarrativeSummaryInput {
  summaryKo?: string | null;
  summaryEn?: string | null;
  sampleTitles?: Array<string | null | undefined> | null;
  keywords?: Array<string | null | undefined> | null;
  fallbackText?: string;
  maxLength?: number;
}

interface NarrativeStageInput {
  velocityPerHour?: number | null;
  acceleration?: number | null;
  spreadScore?: number | null;
}

const SUMMARY_PLACEHOLDER_PREFIXES = [
  "요약 준비 중",
  "summary pending",
  "signals for",
  "응답 없음",
  "current coverage mentions",
  "current posts mention",
  "a representative title references",
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function isPlaceholderSummary(value: string | null | undefined): boolean {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return true;
  }

  return SUMMARY_PLACEHOLDER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function firstSentence(value: string | null | undefined): string | null {
  if (isPlaceholderSummary(value)) {
    return null;
  }

  const normalized = normalizeText(value);
  const first = normalized
    .split(/[.!?。！？]\s*/u)
    .map((item) => item.trim())
    .filter(Boolean)[0];

  return first || null;
}

function firstUsefulValue(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function compactKeywords(keywords: Array<string | null | undefined> | null | undefined): string | null {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return null;
  }

  const resolved = keywords
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 3);

  if (resolved.length === 0) {
    return null;
  }

  return `${resolved.join(" · ")} 관련 이슈`;
}

export function buildNarrativeSummary({
  summaryKo,
  summaryEn,
  sampleTitles,
  keywords,
  fallbackText = "관련 신호를 수집 중입니다.",
  maxLength = 120,
}: NarrativeSummaryInput): string {
  const summaryCandidate = firstSentence(summaryKo) || firstSentence(summaryEn);
  if (summaryCandidate) {
    return truncate(summaryCandidate, maxLength);
  }

  const titleFallback = firstUsefulValue((sampleTitles ?? []) as Array<string | null | undefined>);
  if (titleFallback) {
    return truncate(titleFallback, maxLength);
  }

  const keywordFallback = compactKeywords(keywords);
  if (keywordFallback) {
    return truncate(keywordFallback, maxLength);
  }

  return truncate(normalizeText(fallbackText) || "관련 신호를 수집 중입니다.", maxLength);
}

export function resolveNarrativeStage({
  velocityPerHour,
  acceleration,
  spreadScore,
}: NarrativeStageInput): NarrativeStageKey {
  const velocity = Number.isFinite(velocityPerHour) ? Number(velocityPerHour) : 0;
  const accel = Number.isFinite(acceleration) ? Number(acceleration) : 0;
  const spread = Number.isFinite(spreadScore) ? Number(spreadScore) : 0;

  if (accel < -0.05) {
    return "fading";
  }

  if (spread >= 8 || velocity >= 80) {
    return "peaking";
  }

  if (accel > 0.03 || velocity >= 20) {
    return "spreading";
  }

  return "emerging";
}

export function toNarrativeStageLabel(stage: NarrativeStageKey): string {
  if (stage === "fading") return "쇠퇴";
  if (stage === "peaking") return "피크";
  if (stage === "spreading") return "확산중";
  return "신흥";
}

export function formatLagKorean(lagMinutes: number | null | undefined): string {
  if (!Number.isFinite(lagMinutes) || Number(lagMinutes) <= 0) {
    return "+0m";
  }

  const totalMinutes = Math.round(Number(lagMinutes));
  if (totalMinutes < 60) {
    return `+${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `+${hours}h`;
  }
  return `+${hours}h ${minutes}m`;
}

export function formatTimeOfDay(value: string | number | Date | null | undefined): string {
  const parsed =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : value
          ? new Date(value)
          : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "--:--";
  }

  return parsed.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
