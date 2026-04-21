import {
  getRegionById,
  isLowInfoTopicName,
  normalizeTopicNameValue,
  resolveMeaningfulTopicNames,
} from "@global-pulse/shared";

interface TopicNameEntity {
  text: string;
  type: string;
}

export interface CleanupTopicNameInput {
  nameKo?: string | null;
  nameEn?: string | null;
  summaryKo?: string | null;
  summaryEn?: string | null;
  sampleTitles?: string[] | null;
  regionId?: string | null;
  id?: number | string | null;
  keywords?: string[] | null;
  entities?: TopicNameEntity[] | null;
}

interface CleanupTopicNameOutput {
  displayKo: string;
  displayEn: string;
  isFallback: boolean;
  reason?: string;
  priorityResummarize?: number;
}

const SENSATIONAL_TOKENS = ["\ucda9\uaca9", "\uc12c\ub72d", "\uacbd\uc545", "\uc2e4\ud654", "\uc2f8\ud328", "viral", "shocking", "exclusive"];

function normalizeValue(value: string | null | undefined): string {
  return normalizeTopicNameValue(value);
}

function hasSensationalShortLabel(value: string): boolean {
  const normalized = normalizeValue(value);
  if (!normalized || normalized.length >= 18) {
    return false;
  }
  return SENSATIONAL_TOKENS.some((token) => normalized.toLowerCase().includes(token.toLowerCase()));
}

function findEntityLabel(entities: TopicNameEntity[] | null | undefined): string | null {
  if (!Array.isArray(entities)) {
    return null;
  }

  for (const entity of entities) {
    const text = normalizeValue(entity?.text);
    if (!text) {
      continue;
    }
    if ((entity?.type ?? "other") === "other") {
      continue;
    }
    return text;
  }

  for (const entity of entities) {
    const text = normalizeValue(entity?.text);
    if (text) {
      return text;
    }
  }

  return null;
}

function keywordFallback(keywords: string[] | null | undefined): string | null {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return null;
  }

  const normalized = keywords.map((keyword) => normalizeValue(keyword)).filter(Boolean);
  if (normalized.length === 0) {
    return null;
  }

  return normalized.slice(0, 2).join(" \u00b7 ");
}

function placeholderLabel(regionId: string | null | undefined, id: number | string | null | undefined): string {
  const region = regionId ? getRegionById(regionId) : undefined;
  const flag = region?.flagEmoji ?? "\ud83c\udf10";
  const serial = id ?? "?";
  return `${flag} \ud1a0\ud53d #${serial}`;
}

export function cleanupTopicName(input: CleanupTopicNameInput): CleanupTopicNameOutput {
  const rawNameKo = normalizeValue(input.nameKo);
  const rawNameEn = normalizeValue(input.nameEn);
  const sensational = hasSensationalShortLabel(rawNameKo) || hasSensationalShortLabel(rawNameEn);
  const koLowInfo = isLowInfoTopicName(rawNameKo, "ko");
  const enLowInfo = isLowInfoTopicName(rawNameEn, "en");

  const resolved = resolveMeaningfulTopicNames({
    nameKo: rawNameKo,
    nameEn: rawNameEn,
    summaryKo: input.summaryKo,
    summaryEn: input.summaryEn,
    sampleTitles: input.sampleTitles,
    keywords: input.keywords,
    entities: input.entities,
  });

  const hardFallback = findEntityLabel(input.entities) ?? keywordFallback(input.keywords) ?? placeholderLabel(input.regionId, input.id);
  const displayKo = resolved.nameKo || hardFallback;
  const displayEn = resolved.nameEn || displayKo || hardFallback;
  const isFallback = sensational || koLowInfo || enLowInfo;

  if (!isFallback) {
    return {
      displayKo,
      displayEn,
      isFallback: false,
      priorityResummarize: 0,
    };
  }

  const reason = sensational
    ? "sensational-short-label"
    : resolved.upgradedKo || resolved.upgradedEn
      ? "semantic-upgrade"
      : koLowInfo || enLowInfo
        ? "low-info-label"
        : "lexical-fallback";

  return {
    displayKo,
    displayEn,
    isFallback: true,
    reason,
    priorityResummarize: sensational ? 1 : 0,
  };
}

export function getDisplayTopicName(input: CleanupTopicNameInput): string {
  const cleaned = cleanupTopicName(input);
  return cleaned.displayKo || cleaned.displayEn;
}
