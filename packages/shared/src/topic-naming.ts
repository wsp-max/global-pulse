export type TopicNameLanguage = "ko" | "en";
export type TopicNameSource = "existing" | "summary" | "entities" | "sample_title" | "keywords" | "empty";

export interface TopicNameEvidence {
  nameKo?: string | null;
  nameEn?: string | null;
  summaryKo?: string | null;
  summaryEn?: string | null;
  sampleTitles?: string[] | null;
  keywords?: string[] | null;
  entities?: Array<{ text?: string | null; type?: string | null }> | null;
}

export interface TopicNameResolution {
  nameKo: string;
  nameEn: string;
  sourceKo: TopicNameSource;
  sourceEn: TopicNameSource;
  lowInfoKo: boolean;
  lowInfoEn: boolean;
  upgradedKo: boolean;
  upgradedEn: boolean;
}

const REGION_TOPIC_FALLBACK_REGEX = /^region\s+[a-z]{2}\s+topic\s+\d+$/i;
const GLOBAL_TOPIC_PLACEHOLDER_REGEX =
  /^(?:\ud83c\udf10|\ud83c\uddf0\ud83c\uddf7|\ud83c\uddfa\ud83c\uddf8|\ud83c\uddef\ud83c\uddf5|\ud83c\udde8\ud83c\uddf3|\ud83c\uddea\ud83c\uddfa|\ud83c\uddee\ud83c\uddf3|\ud83c\udde7\ud83c\uddf7|\ud83c\uddf7\ud83c\uddfa)\s*(?:\ud1a0\ud53d|topic)\s*#?\d+/iu;
const BRACKET_PREFIX_REGEX = /^[\[(][^\])]{1,18}[\])]\s*/u;
const LABEL_PREFIX_REGEX = /^(?:\uc18d\ubcf4|\ub77c\uc774\ube0c\s*\uc5c5\ub370\uc774\ud2b8|live|update)\s*[:\-|]\s*/iu;

const PENDING_SET = new Set([
  "summary pending",
  "topic signal",
  "signals for",
  "\uc694\uc57d \uc900\ube44 \uc911",
  "\ubd84\uc11d \uc911",
]);

const LOW_SIGNAL_TERMS = new Set([
  "issue",
  "issues",
  "topic",
  "topics",
  "update",
  "updates",
  "summary",
  "digest",
  "headline",
  "headlines",
  "news",
  "major",
  "related",
  "today",
  "breaking",
  "shocking",
  "exclusive",
  "viral",
  "controversy",
  "discussion",
  "discussions",
  "\uc694\uc57d",
  "\ud1a0\ud53d",
  "\uc18c\uc2dd",
  "\ub274\uc2a4",
  "\uc18d\ubcf4",
  "\ud5e4\ub4dc\ub77c\uc778",
  "\uc624\ub298",
  "\uc8fc\uc694",
  "\uad00\ub828",
]);

const ENGLISH_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const META_SUMMARY_PREFIXES_KO = [
  "\ud604\uc7ac \uc218\uc9d1\ub41c \ubc18\uc751",
  "\ud604\uc7ac \uc218\uc9d1\ub41c \uac8c\uc2dc\uae00",
  "\ub300\ud45c \uc81c\ubaa9",
  "\ud575\uc2ec \ud0a4\uc6cc\ub4dc",
  "\ud575\uc2ec \uc5d4\ud2f0\ud2f0",
];
const META_SUMMARY_PREFIXES_EN = [
  "current coverage mentions",
  "current posts mention",
  "a representative title references",
  "collected posts related to",
  "key entities mentioned",
  "recurring keywords include",
];

const KO_SENTENCE_ENDING_REGEX =
  /(?:\ub2e4|\uc694|\ud569\ub2c8\ub2e4|\ub429\ub2c8\ub2e4|\uc788\uc2b5\ub2c8\ub2e4|\ud55c\ub2e4|\ub41c\ub2e4|\uc911\uc774\ub2e4|\ud558\uace0 \uc788\ub2e4|\ub418\uace0 \uc788\ub2e4|\uc774\uc5b4\uc9c0\uace0 \uc788\ub2e4|\ud655\uc0b0\ub418\uace0 \uc788\ub2e4|\uc8fc\ubaa9\ubc1b\uace0 \uc788\ub2e4|\uc5b8\uae09\ub41c\ub2e4|\uc5b8\uae09\ub418\uace0 \uc788\ub2e4)$/u;
const EN_SENTENCE_VERB_REGEX =
  /\b(?:is|are|was|were|be|been|being|has|have|had|continues?|continued|continuing|draws?|drawing|surges?|surged|surging|spreads?|spread|spreading|accelerates?|accelerated|accelerating|rises?|rose|rising|falls?|fell|falling|faces?|facing|remains?|remaining|grows?|growing|builds?|building|expands?|expanding|prompts?|prompted|prompting|sparks?|sparked|sparking|fuels?|fueled|fueling)\b/i;

const KO_EVENT_TERMS = [
  "\uacf5\uac1c",
  "\ubc1c\ud45c",
  "\ucd9c\uc2dc",
  "\uc778\uc0c1",
  "\uc778\ud558",
  "\uacc4\uc57d",
  "\ud611\uc0c1",
  "\uc870\uc0ac",
  "\uc218\uc0ac",
  "\uc120\uace0",
  "\ub17c\uc758",
  "\ub17c\ub780",
  "\uacf5\ubc29",
  "\uc6b0\ub824",
  "\ubcf4\ub3c4",
  "\ubc1c\uc5b8",
  "\ud68c\ub2f4",
  "\uc120\uac70",
  "\ucd1d\uc120",
  "\uc2dc\uc704",
  "\ud30c\uc5c5",
  "\ud30c\uc5c5",
  "\ud310\uacb0",
  "\uaddc\uc81c",
  "\uc81c\uc7ac",
  "\uc720\ucd9c",
  "\ubcf5\uadc0",
  "\uc5c5\ub370\uc774\ud2b8",
  "\uac1c\ud3b8",
  "\ud3d0\uc9c0",
  "\ubc18\ubc1c",
  "\ubd84\uc7c1",
  "\ub9e4\uac01",
  "\uc0c1\uc7a5",
  "\uc2b9\uc778",
  "\ucde8\uc18c",
  "\uc18c\uc1a1",
  "\ud560\uc778",
  "\uac15\ud654",
  "\uc57d\uc138",
  "\uac15\uc138",
];

const EN_EVENT_TERMS = [
  "announcement",
  "launch",
  "release",
  "reveal",
  "deal",
  "contract",
  "agreement",
  "debate",
  "dispute",
  "controversy",
  "policy",
  "tariff",
  "election",
  "report",
  "lawsuit",
  "investigation",
  "protest",
  "strike",
  "approval",
  "delay",
  "ban",
  "update",
  "leak",
  "merger",
  "acquisition",
  "recall",
  "outage",
  "boycott",
  "filing",
  "shutdown",
  "reform",
  "plan",
  "talks",
  "dealings",
  "pricing",
];

const KO_SUMMARY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\uc8fc\ubaa9\ubc1b\uace0\s+\uc788\uc2b5\ub2c8\ub2e4/gu, "\uc5b8\uae09\ub418\uace0 \uc788\uc2b5\ub2c8\ub2e4"],
  [/\uc8fc\ubaa9\ubc1b\uace0\s+\uc788\ub2e4/gu, "\uc5b8\uae09\ub418\uace0 \uc788\ub2e4"],
  [/\ud655\uc0b0\ub418\uace0\s+\uc788\uc2b5\ub2c8\ub2e4/gu, "\uc5ec\ub7ec \ubc18\uc751\uc5d0\uc11c \uc5b8\uae09\ub429\ub2c8\ub2e4"],
  [/\ud655\uc0b0\ub418\uace0\s+\uc788\ub2e4/gu, "\uc5ec\ub7ec \ubc18\uc751\uc5d0\uc11c \uc5b8\uae09\ub41c\ub2e4"],
  [/\uad00\ub828\s+\ub17c\uc758\uac00\s+\uc774\uc5b4\uc9c0\uace0\s+\uc788\uc2b5\ub2c8\ub2e4/gu, "\uad00\ub828 \uc5b8\uae09\uc774 \uc774\uc5b4\uc9d1\ub2c8\ub2e4"],
  [/\uad00\ub828\s+\ub17c\uc758\uac00\s+\uc774\uc5b4\uc9c0\uace0\s+\uc788\ub2e4/gu, "\uad00\ub828 \uc5b8\uae09\uc774 \uc774\uc5b4\uc9c4\ub2e4"],
  [/\ub17c\uc758\uac00\s+\uc774\uc5b4\uc9c0\uace0\s+\uc788\uc2b5\ub2c8\ub2e4/gu, "\uad00\ub828 \uc5b8\uae09\uc774 \uc774\uc5b4\uc9d1\ub2c8\ub2e4"],
  [/\ub17c\uc758\uac00\s+\uc774\uc5b4\uc9c0\uace0\s+\uc788\ub2e4/gu, "\uad00\ub828 \uc5b8\uae09\uc774 \uc774\uc5b4\uc9c4\ub2e4"],
  [/\uad00\uc2ec\uc774\s+\uc720\uc9c0\ub418\uace0\s+\uc788\uc2b5\ub2c8\ub2e4/gu, "\uc5b8\uae09\uc774 \uc774\uc5b4\uc9d1\ub2c8\ub2e4"],
  [/\uad00\uc2ec\uc774\s+\uc720\uc9c0\ub418\uace0\s+\uc788\ub2e4/gu, "\uc5b8\uae09\uc774 \uc774\uc5b4\uc9c4\ub2e4"],
  [/\ud070\s+\ubc18\uc751\uc744\s+\uc5bb\uace0\s+\uc788\uc2b5\ub2c8\ub2e4/gu, "\ubc18\uc751\uc774 \ud655\uc778\ub429\ub2c8\ub2e4"],
  [/\ud070\s+\ubc18\uc751\uc744\s+\uc5bb\uace0\s+\uc788\ub2e4/gu, "\ubc18\uc751\uc774 \ud655\uc778\ub41c\ub2e4"],
];

const EN_SUMMARY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bis drawing attention\b/gi, "is being discussed"],
  [/\bis continuing\b/gi, "remains under discussion"],
  [/\bis surging\b/gi, "has increased in mentions"],
  [/\bis spreading across regions\b/gi, "appears across multiple regional feeds"],
  [/\bspread(?:ing)? quickly across communities\b/gi, "appeared across multiple communities"],
  [/\bspreading across communities\b/gi, "appearing across multiple communities"],
  [/\bgaining major attention\b/gi, "appearing more frequently in current coverage"],
  [/\bdrawing strong reactions\b/gi, "producing visible reactions"],
];

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function stripTerminalPunctuation(value: string): string {
  return normalizeValue(value).replace(/[.!?\u3002\uFF01\uFF1F]+$/u, "").trim();
}

function countMatches(value: string, pattern: RegExp): number {
  const matched = value.match(pattern);
  return matched ? matched.length : 0;
}

function hasHangul(value: string): boolean {
  return /[\uAC00-\uD7A3]/u.test(value);
}

function hasLatin(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

export function normalizeTopicNameValue(value: string | null | undefined): string {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return "";
  }

  return normalized.replace(BRACKET_PREFIX_REGEX, "").replace(LABEL_PREFIX_REGEX, "").replace(/\s+/g, " ").trim();
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

function firstSentence(value: string | null | undefined): string | null {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }
  if (PENDING_SET.has(normalized.toLowerCase())) {
    return null;
  }

  const first = normalized
    .split(/(?<=[.!?\u3002\uFF01\uFF1F])\s+|\n+/u)
    .map((item) => item.trim())
    .filter(Boolean)[0];

  return first ?? null;
}

function toEnglishDisplayCase(value: string): string {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return "";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function stripOuterQuotes(value: string): string {
  return value.replace(/^["'\u201C\u201D\u2018\u2019]+|["'\u201C\u201D\u2018\u2019]+$/gu, "");
}

function isMetaSummaryForNaming(value: string, language: TopicNameLanguage): boolean {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) {
    return true;
  }

  if (language === "ko") {
    return META_SUMMARY_PREFIXES_KO.some((prefix) => normalized.startsWith(prefix));
  }

  return META_SUMMARY_PREFIXES_EN.some((prefix) => normalized.startsWith(prefix));
}

function isSentenceLike(value: string | null | undefined, language: TopicNameLanguage): boolean {
  const normalized = stripTerminalPunctuation(value ?? "");
  if (!normalized) {
    return false;
  }

  const tokens = dedupeAdjacent(tokenize(normalized));
  if (tokens.length < (language === "ko" ? 2 : 3)) {
    return false;
  }

  if (language === "ko") {
    return KO_SENTENCE_ENDING_REGEX.test(normalized);
  }

  return EN_SENTENCE_VERB_REGEX.test(normalized);
}

function keepDominantScript(value: string): string {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return "";
  }

  const containsHangul = hasHangul(normalized);
  const containsLatin = hasLatin(normalized);
  if (!containsHangul || !containsLatin) {
    return normalized;
  }

  if (isSentenceLike(normalized, "ko") || isSentenceLike(normalized, "en")) {
    return normalized;
  }

  const hangulCount = countMatches(normalized, /[\uAC00-\uD7A3]/gu);
  const latinCount = countMatches(normalized, /[A-Za-z]/g);

  if (hangulCount >= latinCount * 0.5) {
    return normalized
      .replace(/[^\uAC00-\uD7A30-9\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return normalized
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeywords(keywords: string[] | null | undefined, language: TopicNameLanguage): string[] {
  if (!Array.isArray(keywords)) {
    return [];
  }

  const seen = new Set<string>();
  const output: string[] = [];

  for (const rawKeyword of keywords) {
    const keyword = keepDominantScript(normalizeTopicNameValue(rawKeyword));
    if (!keyword) {
      continue;
    }

    const key = keyword.toLowerCase();
    if (seen.has(key) || LOW_SIGNAL_TERMS.has(key)) {
      continue;
    }

    if (isLowInfoTopicName(keyword, language)) {
      continue;
    }

    seen.add(key);
    output.push(normalizeValue(keyword));
    if (output.length >= 4) {
      break;
    }
  }

  return output;
}

function findPrimaryEntity(entities: TopicNameEvidence["entities"]): string | null {
  if (!Array.isArray(entities)) {
    return null;
  }

  for (const entity of entities) {
    const text = keepDominantScript(normalizeTopicNameValue(entity?.text));
    if (!text) {
      continue;
    }
    if ((entity?.type ?? "other") === "other") {
      continue;
    }
    return text;
  }

  for (const entity of entities) {
    const text = keepDominantScript(normalizeTopicNameValue(entity?.text));
    if (text) {
      return text;
    }
  }

  return null;
}

function hasEventCue(value: string, language: TopicNameLanguage): boolean {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return false;
  }

  if (language === "ko") {
    return KO_EVENT_TERMS.some((term) => normalized.includes(term));
  }

  const lowered = normalized.toLowerCase();
  return EN_EVENT_TERMS.some((term) => lowered.includes(term));
}

function buildGenericTopicLabel(value: string, language: TopicNameLanguage): string | null {
  const normalized = stripTerminalPunctuation(keepDominantScript(normalizeTopicNameValue(value)));
  if (!normalized) {
    return null;
  }

  if (language === "ko") {
    return `${normalized} \uad00\ub828 \uc774\uc288`;
  }

  return `${toEnglishDisplayCase(normalized)} related issue`;
}

function clipByTokenWindow(value: string, language: TopicNameLanguage): string {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return "";
  }

  const tokens = dedupeAdjacent(tokenize(normalized));
  if (tokens.length <= 8) {
    return normalized;
  }

  if (language === "en") {
    const loweredTokens = tokens.map((token) => token.toLowerCase());
    const eventIndex = loweredTokens.findIndex((token) => EN_EVENT_TERMS.includes(token));
    if (eventIndex >= 1 && eventIndex < 8) {
      return tokens.slice(0, eventIndex + 1).join(" ");
    }
  } else {
    const eventIndex = tokens.findIndex((token) => KO_EVENT_TERMS.some((term) => token.includes(term)));
    if (eventIndex >= 1 && eventIndex < 8) {
      return tokens.slice(0, eventIndex + 1).join(" ");
    }
  }

  return tokens.slice(0, 8).join(" ");
}

function extractLeadClause(value: string, language: TopicNameLanguage): string {
  let clause = stripOuterQuotes(normalizeValue(value));
  clause = clause.split(/\s*[|:;]\s*/u)[0] ?? clause;
  clause = stripTerminalPunctuation(clause);
  if (!clause) {
    return "";
  }

  if (language === "en") {
    clause = clause
      .replace(/^(?:discussion|conversation|coverage|signals?|talk)\s+(?:around|about|on|of|for)\s+/i, "")
      .replace(/^(?:debate|questions?|concerns?)\s+(?:around|about|over)\s+/i, "")
      .replace(/^(?:a|an|the)\s+/i, "")
      .replace(/\s+\b(?:after|amid|as|while|when|following|because|with)\b.*$/i, "")
      .replace(EN_SENTENCE_VERB_REGEX, "")
      .trim();
  } else {
    clause = clause
      .replace(/^(?:\ub17c\uc758|\ubcf4\ub3c4|\ubc18\uc751|\uc5b8\uae09)\s+/u, "")
      .replace(/\s*(?:\uc774\ud6c4|\ud6c4|\uac00\uc6b4\ub370|\uc18d\uc5d0|\uc5ec\ud30c\ub85c)\b.*$/u, "")
      .replace(/\s*(?:\uc774|\uac00|\uc740|\ub294)?\s*(?:\ub17c\uc758\uac00\s+\uc774\uc5b4\uc9c0\uace0\s+\uc788\ub2e4|\uc8fc\ubaa9\ubc1b\uace0\s+\uc788\ub2e4|\ud655\uc0b0\ub418\uace0\s+\uc788\ub2e4|\uc5b8\uae09\ub418\uace0\s+\uc788\ub2e4|\uc5b8\uae09\ub41c\ub2e4).*$/u, "")
      .replace(KO_SENTENCE_ENDING_REGEX, "")
      .trim();
  }

  return stripTerminalPunctuation(clause);
}

function buildNeutralTopicLabel(
  value: string | null | undefined,
  language: TopicNameLanguage,
  fallbackBase?: string | null,
): string | null {
  const normalized = extractLeadClause(keepDominantScript(normalizeTopicNameValue(value)), language);
  if (!normalized) {
    return fallbackBase ? buildGenericTopicLabel(fallbackBase, language) : null;
  }

  const containsHangul = hasHangul(normalized);
  const containsLatin = hasLatin(normalized);
  if (language === "ko" && containsLatin && !containsHangul) {
    return buildNeutralTopicLabel(normalized, "en", fallbackBase);
  }
  if (language === "en" && containsHangul && !containsLatin) {
    return fallbackBase ? buildGenericTopicLabel(fallbackBase, language) : null;
  }

  if (isMetaSummaryForNaming(normalized, language)) {
    return fallbackBase ? buildGenericTopicLabel(fallbackBase, language) : null;
  }

  const clipped = clipByTokenWindow(normalized, language);
  if (!clipped) {
    return fallbackBase ? buildGenericTopicLabel(fallbackBase, language) : null;
  }

  const displayValue = language === "en" ? toEnglishDisplayCase(clipped) : clipped;

  if (!hasEventCue(displayValue, language) && isLowInfoTopicName(displayValue, language)) {
    return fallbackBase ? buildGenericTopicLabel(fallbackBase, language) : buildGenericTopicLabel(displayValue, language);
  }

  if (!hasEventCue(displayValue, language) && dedupeAdjacent(tokenize(displayValue)).length <= 2) {
    return buildGenericTopicLabel(fallbackBase ?? displayValue, language);
  }

  return displayValue;
}

export function isLowInfoTopicName(
  value: string | null | undefined,
  language: TopicNameLanguage = "ko",
): boolean {
  const normalized = keepDominantScript(normalizeTopicNameValue(value));
  if (!normalized) {
    return true;
  }

  if (
    PENDING_SET.has(normalized.toLowerCase()) ||
    REGION_TOPIC_FALLBACK_REGEX.test(normalized) ||
    GLOBAL_TOPIC_PLACEHOLDER_REGEX.test(normalized)
  ) {
    return true;
  }

  if (language === "ko" && /.+\s+\uad00\ub828\s+(?:\uc774\uc288|\ub17c\uc758)$/u.test(normalized)) {
    return false;
  }
  if (language === "en" && /.+\s+related\s+(?:issue|discussion)$/i.test(normalized)) {
    return false;
  }

  const tokens = dedupeAdjacent(tokenize(normalized));
  if (tokens.length === 0) {
    return true;
  }

  const meaningfulTokens = tokens.filter((token) => {
    const lowered = token.toLowerCase();
    if (LOW_SIGNAL_TERMS.has(lowered)) {
      return false;
    }
    if (language === "en" && ENGLISH_STOPWORDS.has(lowered)) {
      return false;
    }
    return token.length >= (language === "ko" ? 2 : 3);
  });

  if (meaningfulTokens.length === 0) {
    return true;
  }

  if (language === "ko") {
    if (tokens.length === 1 && normalized.length <= 8) {
      return true;
    }
    if (tokens.length === 2 && tokens.every((token) => token.length <= 2) && !hasEventCue(normalized, language)) {
      return true;
    }
    return false;
  }

  if (tokens.length === 1 && tokens[0]!.length <= 10) {
    return true;
  }

  const lexicalDensity = meaningfulTokens.length / Math.max(tokens.length, 1);
  return lexicalDensity < 0.5 && !hasEventCue(normalized, language);
}

function buildSummaryCandidate(summary: string | null | undefined, language: TopicNameLanguage): string | null {
  const sentence = firstSentence(summary);
  if (!sentence) {
    return null;
  }

  const sanitized = sanitizeTopicSummaryText(sentence, language);
  if (!sanitized || isMetaSummaryForNaming(sanitized, language)) {
    return null;
  }

  return buildNeutralTopicLabel(sanitized, language);
}

function buildEntityKeywordCandidate(input: TopicNameEvidence, language: TopicNameLanguage): string | null {
  const entity = findPrimaryEntity(input.entities);
  if (!entity) {
    return null;
  }

  const keywords = normalizeKeywords(input.keywords, language).filter(
    (keyword) => !entity.toLowerCase().includes(keyword.toLowerCase()),
  );

  const eventKeyword =
    keywords.find((keyword) => hasEventCue(keyword, language)) ??
    keywords.find((keyword) => dedupeAdjacent(tokenize(keyword)).length >= 2);
  if (!eventKeyword) {
    return buildGenericTopicLabel(entity, language);
  }

  return buildNeutralTopicLabel(`${entity} ${eventKeyword}`, language, entity);
}

function buildSampleTitleCandidate(sampleTitles: string[] | null | undefined, language: TopicNameLanguage): string | null {
  if (!Array.isArray(sampleTitles) || sampleTitles.length === 0) {
    return null;
  }

  for (const title of sampleTitles) {
    const normalized = keepDominantScript(normalizeTopicNameValue(title));
    if (!normalized) {
      continue;
    }

    const candidate = buildNeutralTopicLabel(normalized, language);
    if (!candidate || isLowInfoTopicName(candidate, language)) {
      continue;
    }
    return candidate;
  }

  return null;
}

function buildKeywordCandidate(keywords: string[] | null | undefined, language: TopicNameLanguage): string | null {
  const normalizedKeywords = normalizeKeywords(keywords, language);
  if (normalizedKeywords.length === 0) {
    return null;
  }

  const eventKeyword = normalizedKeywords.find((keyword) => hasEventCue(keyword, language));
  if (eventKeyword) {
    return buildNeutralTopicLabel(eventKeyword, language);
  }

  const combined = normalizedKeywords.slice(0, 2).join(" ");
  return buildNeutralTopicLabel(combined, language);
}

function shouldPreferCandidate(existing: string, candidate: string | null, language: TopicNameLanguage): boolean {
  if (!candidate) {
    return false;
  }

  const normalizedExisting = normalizeValue(existing);
  const normalizedCandidate = normalizeValue(candidate);
  if (!normalizedExisting || !normalizedCandidate) {
    return false;
  }
  if (normalizedExisting.toLowerCase() === normalizedCandidate.toLowerCase()) {
    return false;
  }

  const existingHasEvent = hasEventCue(normalizedExisting, language);
  const candidateHasEvent = hasEventCue(normalizedCandidate, language);
  if (candidateHasEvent && !existingHasEvent) {
    return true;
  }

  const existingTokens = dedupeAdjacent(tokenize(normalizedExisting));
  const candidateTokens = dedupeAdjacent(tokenize(normalizedCandidate));
  if (candidateTokens.length <= existingTokens.length) {
    return false;
  }

  if (existingTokens.length <= 2 && candidateTokens.length <= 8) {
    return true;
  }

  if (language === "ko" && normalizedExisting.length <= 10 && normalizedCandidate.length > normalizedExisting.length) {
    return true;
  }
  if (language === "en" && normalizedExisting.length <= 24 && normalizedCandidate.length > normalizedExisting.length) {
    return true;
  }

  return false;
}

function resolveName(
  language: TopicNameLanguage,
  input: TopicNameEvidence,
): { name: string; source: TopicNameSource; lowInfo: boolean; upgraded: boolean } {
  const existingRaw = keepDominantScript(normalizeTopicNameValue(language === "ko" ? input.nameKo : input.nameEn));
  const counterpartRaw = keepDominantScript(normalizeTopicNameValue(language === "ko" ? input.nameEn : input.nameKo));
  const lowInfo = isLowInfoTopicName(existingRaw, language);

  const existing = buildNeutralTopicLabel(existingRaw, language, findPrimaryEntity(input.entities));
  const summaryCandidate = buildSummaryCandidate(language === "ko" ? input.summaryKo : input.summaryEn, language);
  const entityCandidate = buildEntityKeywordCandidate(input, language);
  const sampleTitleCandidate = buildSampleTitleCandidate(input.sampleTitles, language);
  const keywordCandidate = buildKeywordCandidate(input.keywords, language);
  const counterpartLanguage = language === "ko" ? "en" : "ko";
  const counterpart = buildNeutralTopicLabel(counterpartRaw, counterpartLanguage, findPrimaryEntity(input.entities));

  const upgradeCandidates: Array<{ value: string | null; source: TopicNameSource }> = [
    { value: summaryCandidate, source: "summary" },
    { value: entityCandidate, source: "entities" },
    { value: sampleTitleCandidate, source: "sample_title" },
    { value: keywordCandidate, source: "keywords" },
  ];

  if (existing && !isLowInfoTopicName(existing, language)) {
    for (const candidate of upgradeCandidates) {
      if (shouldPreferCandidate(existing, candidate.value, language)) {
        return {
          name: normalizeTopicNameValue(candidate.value),
          source: candidate.source,
          lowInfo,
          upgraded: normalizeTopicNameValue(candidate.value) !== existingRaw,
        };
      }
    }

    return {
      name: existing,
      source: "existing",
      lowInfo,
      upgraded: existing !== existingRaw,
    };
  }

  for (const candidate of upgradeCandidates) {
    const value = normalizeTopicNameValue(candidate.value);
    if (!value || isLowInfoTopicName(value, language)) {
      continue;
    }

    return {
      name: value,
      source: candidate.source,
      lowInfo,
      upgraded: candidate.source !== "existing" || value !== existingRaw,
    };
  }

  const counterpartValue = normalizeTopicNameValue(counterpart);
  if (counterpartValue && !isLowInfoTopicName(counterpartValue, counterpartLanguage)) {
    return {
      name: counterpartValue,
      source: "existing",
      lowInfo,
      upgraded: counterpartValue !== existingRaw,
    };
  }

  const fallback = existing || counterpart || "";
  return {
    name: fallback,
    source: fallback ? "existing" : "empty",
    lowInfo,
    upgraded: fallback !== existingRaw,
  };
}

export function sanitizeTopicSummaryText(
  value: string | null | undefined,
  language: TopicNameLanguage,
): string {
  let normalized = normalizeValue(value);
  if (!normalized) {
    return "";
  }
  if (PENDING_SET.has(normalized.toLowerCase())) {
    return "";
  }

  const replacements = language === "ko" ? KO_SUMMARY_REPLACEMENTS : EN_SUMMARY_REPLACEMENTS;
  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

export function resolveMeaningfulTopicNames(input: TopicNameEvidence): TopicNameResolution {
  const ko = resolveName("ko", input);
  const en = resolveName("en", input);

  return {
    nameKo: ko.name || en.name,
    nameEn: en.name || ko.name,
    sourceKo: ko.source,
    sourceEn: en.source,
    lowInfoKo: ko.lowInfo,
    lowInfoEn: en.lowInfo,
    upgradedKo: ko.upgraded,
    upgradedEn: en.upgraded,
  };
}
