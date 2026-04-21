import { sanitizeTopicSummaryText, type Topic } from "@global-pulse/shared";

interface SummaryPair {
  summaryKo: string;
  summaryEn: string;
}

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
    summaryKo: sanitizeTopicSummaryText(`\ud604\uc7ac \uc218\uc9d1\ub41c \ubc18\uc751\uc5d0\uc11c\ub294 ${joined}\uc774(\uac00) \ud568\uaed8 \uc5b8\uae09\ub41c\ub2e4.`, "ko"),
    summaryEn: sanitizeTopicSummaryText(`Current coverage mentions ${joined} together in this issue.`, "en"),
  };
}

function pickKeywordSummary(topic: Topic): SummaryPair | null {
  const keywords = uniqueValues(topic.keywords ?? []).slice(0, 3);
  if (keywords.length === 0) {
    return null;
  }

  const joined = keywords.join(" \u00b7 ");
  return {
    summaryKo: sanitizeTopicSummaryText(`\ud604\uc7ac \uac8c\uc2dc\uae00\uc5d0\uc11c\ub294 ${joined} \ud0a4\uc6cc\ub4dc\uac00 \ud568\uaed8 \uc5b8\uae09\ub41c\ub2e4.`, "ko"),
    summaryEn: sanitizeTopicSummaryText(`Current posts mention the keywords ${joined} together.`, "en"),
  };
}

function pickSampleTitleSummary(topic: Topic): SummaryPair | null {
  const sampleTitle = normalize(topic.sampleTitles?.[0]);
  if (!sampleTitle) {
    return null;
  }

  const clipped = sampleTitle.length > 96 ? `${sampleTitle.slice(0, 95).trimEnd()}\u2026` : sampleTitle;
  return {
    summaryKo: sanitizeTopicSummaryText(`\ub300\ud45c \uc81c\ubaa9\uc5d0\uc11c\ub294 "${clipped}" \ub0b4\uc6a9\uc774 \uc5b8\uae09\ub41c\ub2e4.`, "ko"),
    summaryEn: sanitizeTopicSummaryText(`A representative title references "${clipped}".`, "en"),
  };
}

function safeFallbackSummary(topic: Topic): SummaryPair {
  const koLabel = normalize(topic.nameKo) || normalize(topic.nameEn) || "\ud574\ub2f9 \ud1a0\ud53d";
  const enLabel = normalize(topic.nameEn) || normalize(topic.nameKo) || "this topic";
  return {
    summaryKo: sanitizeTopicSummaryText(`${koLabel}\uacfc \uad00\ub828\ub41c \uac8c\uc2dc\uae00\uc744 \uae30\ubc18\uc73c\ub85c \uc694\uc57d\uc744 \uad6c\uc131 \uc911\uc774\ub2e4.`, "ko"),
    summaryEn: sanitizeTopicSummaryText(`A summary is being prepared from collected posts related to ${enLabel}.`, "en"),
  };
}

export function buildTopicSummaryFallback(topic: Topic): SummaryPair {
  return (
    pickEntitySummary(topic) ??
    pickKeywordSummary(topic) ??
    pickSampleTitleSummary(topic) ??
    safeFallbackSummary(topic)
  );
}
