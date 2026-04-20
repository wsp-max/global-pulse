import type { Topic } from "@global-pulse/shared";

const ENGLISH_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "know",
  "lots",
  "may",
  "of",
  "on",
  "or",
  "s",
  "someone",
  "t",
  "that",
  "the",
  "their",
  "there",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "who",
  "why",
  "with",
]);

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function countMatches(value: string, pattern: RegExp): number {
  const matched = value.match(pattern);
  return matched ? matched.length : 0;
}

function keepDominantScript(value: string): string {
  const hasHangul = /[가-힣]/u.test(value);
  const hasLatin = /[A-Za-z]/u.test(value);
  if (!hasHangul || !hasLatin) {
    return value;
  }

  const hangulCount = countMatches(value, /[가-힣]/gu);
  const latinCount = countMatches(value, /[A-Za-z]/g);

  if (hangulCount >= latinCount * 0.5) {
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

function tokenize(value: string): string[] {
  return value
    .split(/[\s/|,:;()[\]{}'"`~!@#$%^&*+=?.-]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function dedupeAdjacent(tokens: string[]): string[] {
  const output: string[] = [];
  for (const token of tokens) {
    if (output.length === 0 || output[output.length - 1]!.toLowerCase() !== token.toLowerCase()) {
      output.push(token);
    }
  }
  return output;
}

function fallbackLabel(topic: Topic): string {
  const entityLabel = (topic.entities ?? []).find((entity) => entity.type !== "other" && normalizeValue(entity.text));
  if (entityLabel) {
    return normalizeValue(entityLabel.text);
  }
  const keyword = (topic.keywords ?? []).map((item) => normalizeValue(item)).find(Boolean);
  if (keyword) {
    return keyword;
  }
  return normalizeValue(topic.nameKo) || normalizeValue(topic.nameEn) || "토픽";
}

function refineName(baseName: string, topic: Topic): string {
  const dominant = keepDominantScript(normalizeValue(baseName));
  const tokens = dedupeAdjacent(tokenize(dominant));
  if (tokens.length === 0) {
    return fallbackLabel(topic);
  }

  const hasCjkScript = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
    dominant,
  );
  const filtered = tokens.filter((token) =>
    hasCjkScript ? token.length >= 2 : token.length >= 3,
  );
  const selected = (filtered.length > 0 ? filtered : tokens).slice(0, 3);

  let label = selected.join(" · ");
  if (tokens.length <= 3) {
    label = tokens.join(" ");
  }

  const englishTokens = tokenize(label.toLowerCase()).filter((token) => /^[a-z]+$/u.test(token));
  if (englishTokens.length > 0 && englishTokens.every((token) => ENGLISH_STOPWORDS.has(token))) {
    return fallbackLabel(topic);
  }

  return normalizeValue(label) || fallbackLabel(topic);
}

export function normalizeTopicNamesForStorage(topic: Topic): Pick<Topic, "nameKo" | "nameEn"> {
  return {
    nameKo: refineName(topic.nameKo, topic),
    nameEn: refineName(topic.nameEn, topic),
  };
}
