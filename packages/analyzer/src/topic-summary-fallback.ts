import type { Topic } from "@global-pulse/shared";

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
    summaryKo: `핵심 엔티티 ${joined} 중심으로 반응이 모이고 있습니다.`,
    summaryEn: `Discussion is converging around key entities: ${joined}.`,
  };
}

function pickKeywordSummary(topic: Topic): SummaryPair | null {
  const keywords = uniqueValues(topic.keywords ?? []).slice(0, 3);
  if (keywords.length === 0) {
    return null;
  }
  const joined = keywords.join(" · ");
  return {
    summaryKo: `핵심 키워드 ${joined} 중심으로 반응이 모이고 있습니다.`,
    summaryEn: `Community reactions are clustering around keywords: ${joined}.`,
  };
}

function pickSampleTitleSummary(topic: Topic): SummaryPair | null {
  const sampleTitle = normalize(topic.sampleTitles?.[0]);
  if (!sampleTitle) {
    return null;
  }

  const clipped = sampleTitle.length > 96 ? `${sampleTitle.slice(0, 95).trimEnd()}…` : sampleTitle;
  return {
    summaryKo: `대표 게시글 "${clipped}"을 중심으로 관련 반응이 확산되고 있습니다.`,
    summaryEn: `The thread is expanding around "${clipped}".`,
  };
}

function safeFallbackSummary(topic: Topic): SummaryPair {
  const koLabel = normalize(topic.nameKo) || normalize(topic.nameEn) || "해당 토픽";
  const enLabel = normalize(topic.nameEn) || normalize(topic.nameKo) || "this topic";
  return {
    summaryKo: `${koLabel} 관련 반응을 집계하고 있습니다.`,
    summaryEn: `Signals for ${enLabel} are being aggregated.`,
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
