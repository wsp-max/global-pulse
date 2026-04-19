import type { TopicEntity } from "@global-pulse/shared";

interface BuildTopicSummariesInput {
  summaryKo?: string | null;
  summaryEn?: string | null;
  nameKo?: string | null;
  nameEn?: string | null;
  keywords?: string[] | null;
  entities?: TopicEntity[] | null;
  sampleTitles?: string[] | null;
}

interface TopicSummaryPair {
  summaryKo: string;
  summaryEn: string;
}

const PENDING_MARKERS = new Set([
  "요약 준비 중",
  "summary pending",
  "요약 준비중",
  "pending summary",
]);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function isPendingSummary(value: string | null | undefined): boolean {
  const normalized = normalizeText(value).toLowerCase();
  return !normalized || PENDING_MARKERS.has(normalized);
}

function uniqueList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function buildFromEntities(entities: TopicEntity[] | null | undefined): TopicSummaryPair | null {
  if (!Array.isArray(entities) || entities.length === 0) {
    return null;
  }

  const labels = uniqueList(
    entities
      .filter((entity) => entity && entity.type !== "other")
      .map((entity) => entity.text),
  ).slice(0, 3);

  if (labels.length === 0) {
    return null;
  }

  const joined = labels.join(", ");
  return {
    summaryKo: `${joined} 관련 반응이 확산되고 있습니다.`,
    summaryEn: `Discussion around ${joined} is spreading across regions.`,
  };
}

function buildFromKeywords(keywords: string[] | null | undefined): TopicSummaryPair | null {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return null;
  }

  const labels = uniqueList(keywords).slice(0, 3);
  if (labels.length === 0) {
    return null;
  }

  const joined = labels.join(" · ");
  return {
    summaryKo: `핵심 키워드 ${joined} 중심으로 반응이 모이고 있습니다.`,
    summaryEn: `Signals are converging on keywords: ${joined}.`,
  };
}

function buildFromSampleTitle(sampleTitles: string[] | null | undefined): TopicSummaryPair | null {
  if (!Array.isArray(sampleTitles) || sampleTitles.length === 0) {
    return null;
  }

  const first = normalizeText(sampleTitles[0]);
  if (!first) {
    return null;
  }

  const compact = truncateText(first.replace(/^["'“”‘’]+|["'“”‘’]+$/g, ""), 100);
  return {
    summaryKo: `대표 게시글 "${compact}" 중심으로 반응이 확산되고 있습니다.`,
    summaryEn: `The discussion is building around "${compact}".`,
  };
}

function buildSafeFallback(nameKo?: string | null, nameEn?: string | null): TopicSummaryPair {
  const koLabel = normalizeText(nameKo) || normalizeText(nameEn) || "해당 토픽";
  const enLabel = normalizeText(nameEn) || normalizeText(nameKo) || "this topic";

  return {
    summaryKo: `${koLabel} 관련 반응을 집계 중이며 곧 상세 요약이 반영됩니다.`,
    summaryEn: `Signals for ${enLabel} are being aggregated and a detailed summary will be updated shortly.`,
  };
}

function buildFallbackSummaries(input: BuildTopicSummariesInput): TopicSummaryPair {
  return (
    buildFromEntities(input.entities) ??
    buildFromKeywords(input.keywords) ??
    buildFromSampleTitle(input.sampleTitles) ??
    buildSafeFallback(input.nameKo, input.nameEn)
  );
}

export function buildTopicSummaries(input: BuildTopicSummariesInput): TopicSummaryPair {
  const fallback = buildFallbackSummaries(input);

  const summaryKo = isPendingSummary(input.summaryKo) ? fallback.summaryKo : normalizeText(input.summaryKo);
  const summaryEn = isPendingSummary(input.summaryEn) ? fallback.summaryEn : normalizeText(input.summaryEn);

  return {
    summaryKo: summaryKo || fallback.summaryKo,
    summaryEn: summaryEn || fallback.summaryEn,
  };
}
