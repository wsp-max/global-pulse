import { cleanText, cleanUrl } from "../../utils/text-cleaner";

const CLICKBAIT_PREFIX = new RegExp(
  String.raw`^(?:\[[^\]]*]|\([^)]+\)|【[^】]+】)?\s*(?:충격|속보|단독|긴급|速報|衝撃|震惊|重磅)\s*(?::|-|\|)?\s*`,
  "i",
);

export function sanitizeNewsTitle(input: string): string {
  const cleaned = cleanText(input).normalize("NFKC");
  return cleaned.replace(CLICKBAIT_PREFIX, "").replace(/\s+/g, " ").trim();
}

export function sanitizeNewsBodyPreview(
  input: string | null | undefined,
  maxLength = 280,
): string | undefined {
  const cleaned = cleanText(input ?? "");
  if (!cleaned) {
    return undefined;
  }
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
}

export function sanitizeNewsUrl(input: string | null | undefined): string | undefined {
  const cleaned = cleanUrl(input ?? "");
  return cleaned || undefined;
}

export function normalizePublishedAt(input: string | null | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

export function extractNumericCount(input: string | null | undefined): number | undefined {
  if (!input) {
    return undefined;
  }
  const match = input.replace(/,/g, "").match(/(\d{1,12})/);
  if (!match?.[1]) {
    return undefined;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
