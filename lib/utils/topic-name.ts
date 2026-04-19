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
}

const REGION_TOPIC_FALLBACK_REGEX = /^region\s+[a-z]{2}\s+topic\s+\d+$/i;
const PENDING_SET = new Set(["topic signal", "summary pending", "요약 준비 중"]);

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

export function cleanupTopicName(input: CleanupTopicNameInput): CleanupTopicNameOutput {
  const nameKo = normalizeValue(input.nameKo);
  const nameEn = normalizeValue(input.nameEn);

  const koFallbackByPattern = nameKo.length === 0 || isPendingValue(nameKo) || isRegionTopicFallback(nameKo);
  const enFallbackByPattern = nameEn.length === 0 || isPendingValue(nameEn) || isRegionTopicFallback(nameEn);
  const hasMeaningfulEntity = Boolean(findEntityLabel(input.entities));
  const koLowInfo = nameKo.length > 0 && isKoTwoTokenLowInfo(nameKo) && !hasMeaningfulEntity;

  const isFallback = koFallbackByPattern || enFallbackByPattern || koLowInfo;
  if (!isFallback) {
    return {
      displayKo: nameKo || nameEn,
      displayEn: nameEn || nameKo,
      isFallback: false,
    };
  }

  const entityLabel = findEntityLabel(input.entities);
  const keywordLabel = keywordFallback(input.keywords);
  const fallback = entityLabel ?? keywordLabel ?? placeholderLabel(input.regionId, input.id);
  const reason = koLowInfo ? "low-info-ko-label" : koFallbackByPattern || enFallbackByPattern ? "lexical-fallback" : "unknown";

  return {
    displayKo: fallback,
    displayEn: fallback,
    isFallback: true,
    reason,
  };
}
