import { sanitizeTopicSummaryText, type Topic } from "@global-pulse/shared";

interface SummaryPair {
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

function normalize(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function isFallbackLikeSummary(value: string | null | undefined): boolean {
  const normalized = normalize(value).toLowerCase();
  if (!normalized || PENDING_MARKERS.has(normalized)) {
    return true;
  }

  return (
    META_SUMMARY_PREFIXES_KO.some((prefix) => normalized.startsWith(prefix)) ||
    META_SUMMARY_PREFIXES_EN.some((prefix) => normalized.startsWith(prefix))
  );
}

function pickEntitySummary(topic: Topic): SummaryPair | null {
  const labels = uniqueValues(
    (topic.entities ?? [])
      .filter((entity) => entity.type !== "other")
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

function pickKeywordSummary(topic: Topic): SummaryPair | null {
  const keywords = uniqueValues(topic.keywords ?? []).slice(0, 3);
  if (keywords.length === 0) {
    return null;
  }

  const joined = keywords.join(" \u00b7 ");
  return {
    summaryKo: sanitizeTopicSummaryText(joined, "ko"),
    summaryEn: sanitizeTopicSummaryText(joined, "en"),
  };
}

function pickSampleTitleSummary(topic: Topic): SummaryPair | null {
  const sampleTitle = normalize(topic.sampleTitles?.[0]);
  if (!sampleTitle) {
    return null;
  }

  const clipped = sampleTitle.length > 96 ? `${sampleTitle.slice(0, 95).trimEnd()}\u2026` : sampleTitle;
  return {
    summaryKo: sanitizeTopicSummaryText(clipped, "ko"),
    summaryEn: sanitizeTopicSummaryText(clipped, "en"),
  };
}

function safeFallbackSummary(topic: Topic): SummaryPair {
  const koLabel = normalize(topic.nameKo) || normalize(topic.nameEn) || "\ud574\ub2f9 \ud1a0\ud53d";
  const enLabel = normalize(topic.nameEn) || normalize(topic.nameKo) || "this topic";
  return {
    summaryKo: sanitizeTopicSummaryText(koLabel, "ko"),
    summaryEn: sanitizeTopicSummaryText(enLabel, "en"),
  };
}

export function buildTopicSummaryFallback(topic: Topic): SummaryPair {
  if (!isFallbackLikeSummary(topic.summaryKo) && !isFallbackLikeSummary(topic.summaryEn)) {
    return {
      summaryKo: sanitizeTopicSummaryText(normalize(topic.summaryKo), "ko"),
      summaryEn: sanitizeTopicSummaryText(normalize(topic.summaryEn), "en"),
    };
  }

  return (
    pickEntitySummary(topic) ??
    pickSampleTitleSummary(topic) ??
    pickKeywordSummary(topic) ??
    safeFallbackSummary(topic)
  );
}
