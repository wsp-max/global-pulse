import { getRegionById } from "@global-pulse/shared";

interface TopicNameEntity {
  text: string;
  type: string;
}

interface CleanupTopicNameInput {
  nameKo?: string | null;
  nameEn?: string | null;
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

const REGION_TOPIC_FALLBACK_REGEX = /^region\s+[a-z]{2}\s+topic\s+\d+$/i;
const PENDING_SET = new Set(["topic signal", "summary pending", "요약 준비 중"]);
const SENSATIONAL_TOKENS = ["충격", "섬뜩", "경악", "실화", "논란 자체", "싸패"];

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim();
}

function isPendingValue(value: string): boolean {
  return PENDING_SET.has(value.toLowerCase());
}

function isRegionTopicFallback(value: string): boolean {
  return REGION_TOPIC_FALLBACK_REGEX.test(value);
}

function isKoTwoTokenLowInfo(value: string): boolean {
  const tokens = value
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.length === 2 && tokens.every((token) => token.length <= 4);
}

function findEntityLabel(entities: TopicNameEntity[] | null | undefined): string | null {
  if (!Array.isArray(entities)) {
    return null;
  }
  for (const entity of entities) {
    if (!entity?.text) {
      continue;
    }
    const text = normalizeValue(entity.text);
    if (!text) {
      continue;
    }
    if ((entity.type ?? "other") === "other") {
      continue;
    }
    return text;
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
  return normalized.slice(0, 2).join(" · ");
}

function placeholderLabel(regionId: string | null | undefined, id: number | string | null | undefined): string {
  const region = regionId ? getRegionById(regionId) : undefined;
  const flag = region?.flagEmoji ?? "🌐";
  const serial = id ?? "?";
  return `${flag} 토픽 #${serial}`;
}

function countByRegex(value: string, pattern: RegExp): number {
  const matched = value.match(pattern);
  return matched ? matched.length : 0;
}

function keepDominantScript(value: string): string {
  const hasHangul = /[가-힣]/u.test(value);
  const hasLatin = /[A-Za-z]/u.test(value);

  if (!hasHangul || !hasLatin) {
    return value;
  }

  const hangulCount = countByRegex(value, /[가-힣]/gu);
  const latinCount = countByRegex(value, /[A-Za-z]/g);

  if (hangulCount >= latinCount) {
    return value
      .replace(/[^가-힣0-9\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return value
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasSensationalShortLabel(value: string): boolean {
  const normalized = normalizeValue(value);
  if (!normalized || normalized.length >= 12) {
    return false;
  }
  return SENSATIONAL_TOKENS.some((token) => normalized.includes(token));
}

export function cleanupTopicName(input: CleanupTopicNameInput): CleanupTopicNameOutput {
  const rawNameKo = normalizeValue(input.nameKo);
  const rawNameEn = normalizeValue(input.nameEn);
  const nameKo = keepDominantScript(rawNameKo);
  const nameEn = keepDominantScript(rawNameEn);

  const koFallbackByPattern = nameKo.length === 0 || isPendingValue(nameKo) || isRegionTopicFallback(nameKo);
  const enFallbackByPattern = nameEn.length === 0 || isPendingValue(nameEn) || isRegionTopicFallback(nameEn);
  const hasMeaningfulEntity = Boolean(findEntityLabel(input.entities));
  const koLowInfo = nameKo.length > 0 && isKoTwoTokenLowInfo(nameKo) && !hasMeaningfulEntity;
  const sensational = hasSensationalShortLabel(nameKo) || hasSensationalShortLabel(nameEn);

  const isFallback = koFallbackByPattern || enFallbackByPattern || koLowInfo || sensational;
  if (!isFallback) {
    return {
      displayKo: nameKo || nameEn,
      displayEn: nameEn || nameKo,
      isFallback: false,
      priorityResummarize: 0,
    };
  }

  const entityLabel = findEntityLabel(input.entities);
  const keywordLabel = keywordFallback(input.keywords);
  const fallback = entityLabel ?? keywordLabel ?? placeholderLabel(input.regionId, input.id);
  const reason = sensational
    ? "sensational-short-label"
    : koLowInfo
      ? "low-info-ko-label"
      : koFallbackByPattern || enFallbackByPattern
        ? "lexical-fallback"
        : "unknown";

  return {
    displayKo: fallback,
    displayEn: fallback,
    isFallback: true,
    reason,
    priorityResummarize: sensational ? 1 : 0,
  };
}
