import { sanitizeTopicSummaryText, type TopicEntity } from "@global-pulse/shared";

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
  "\uc694\uc57d \uc900\ube44 \uc911",
  "summary pending",
  "\uc694\uc57d \uc900\ube44\uc911",
  "pending summary",
]);

const META_SUMMARY_PREFIXES_KO = [
  "\ud604\uc7ac \uc218\uc9d1\ub41c \ubc18\uc751",
  "\ud604\uc7ac \uc218\uc9d1\ub41c \uac8c\uc2dc\uae00",
  "\ud604\uc7ac \uac8c\uc2dc\uae00",
  "\ub300\ud45c \uc81c\ubaa9",
];

const META_SUMMARY_PREFIXES_EN = [
  "current coverage mentions",
  "current posts mention",
  "a representative title references",
  "a summary is being prepared from collected posts related to",
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}\u2026`;
}

function isPendingSummary(value: string | null | undefined): boolean {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized || PENDING_MARKERS.has(normalized)) {
    return true;
  }

  return (
    META_SUMMARY_PREFIXES_KO.some((prefix) => normalized.startsWith(prefix)) ||
    META_SUMMARY_PREFIXES_EN.some((prefix) => normalized.startsWith(prefix))
  );
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
    summaryKo: sanitizeTopicSummaryText(joined, "ko"),
    summaryEn: sanitizeTopicSummaryText(joined, "en"),
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

  const joined = labels.join(" \u00b7 ");
  return {
    summaryKo: sanitizeTopicSummaryText(joined, "ko"),
    summaryEn: sanitizeTopicSummaryText(joined, "en"),
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

  const compact = truncateText(first.replace(/^["'\u201C\u201D\u2018\u2019]+|["'\u201C\u201D\u2018\u2019]+$/gu, ""), 100);
  return {
    summaryKo: sanitizeTopicSummaryText(compact, "ko"),
    summaryEn: sanitizeTopicSummaryText(compact, "en"),
  };
}

function buildSafeFallback(nameKo?: string | null, nameEn?: string | null): TopicSummaryPair {
  const koLabel = normalizeText(nameKo) || normalizeText(nameEn) || "\ubbf8\uc0c1 \ud1a0\ud53d";
  const enLabel = normalizeText(nameEn) || normalizeText(nameKo) || "this topic";

  return {
    summaryKo: sanitizeTopicSummaryText(koLabel, "ko"),
    summaryEn: sanitizeTopicSummaryText(enLabel, "en"),
  };
}

function buildFallbackSummaries(input: BuildTopicSummariesInput): TopicSummaryPair {
  return (
    buildFromEntities(input.entities) ??
    buildFromSampleTitle(input.sampleTitles) ??
    buildFromKeywords(input.keywords) ??
    buildSafeFallback(input.nameKo, input.nameEn)
  );
}

export function buildTopicSummaries(input: BuildTopicSummariesInput): TopicSummaryPair {
  const fallback = buildFallbackSummaries(input);

  const summaryKo = isPendingSummary(input.summaryKo)
    ? fallback.summaryKo
    : sanitizeTopicSummaryText(normalizeText(input.summaryKo), "ko");
  const summaryEn = isPendingSummary(input.summaryEn)
    ? fallback.summaryEn
    : sanitizeTopicSummaryText(normalizeText(input.summaryEn), "en");

  return {
    summaryKo: summaryKo || fallback.summaryKo,
    summaryEn: summaryEn || fallback.summaryEn,
  };
}

const topicSummaryUtils = {
  buildTopicSummaries,
};

export default topicSummaryUtils;
