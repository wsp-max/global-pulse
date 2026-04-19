import { SOURCES } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";
import type { Pool } from "pg";

export interface KeywordScore {
  keyword: string;
  score: number;
  relatedPostIds: string[];
}

export interface AnalysisPostInput {
  id: string;
  sourceId: string;
  title: string;
  bodyPreview?: string | null;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  postedAt?: string | null;
  collectedAt?: string | null;
}

const BASE_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "has",
  "was",
  "were",
  "will",
  "about",
  "into",
  "https",
  "http",
  "www",
  "com",
  "net",
  "org",
  "co",
  "amp",
  "news",
  "issue",
  "topic",
  "update",
  "video",
  "shorts",
  "live",
  "reddit",
  "youtube",
  "youtu",
  "thread",
  "post",
  "official",
  "breaking",
  "latest",
  "watch",
  "report",
  "says",
  "said",
  "new",
  "more",
  "today",
  "music",
  "mv",
  "trailer",
  "episode",
  "director",
  "producer",
  "production",
  "release",
  "released",
  "stream",
  "subscribe",
  "channel",
  "follow",
  "group",
  "final",
  "people",
  "you",
  "your",
  "what",
  "when",
  "where",
  "who",
  "why",
  "how",
  "not",
  "just",
  "lol",
  "lmao",
  "omg",
  "wow",
  "credit",
  "credits",
  "full",
  "clip",
  "album",
  "single",
  "title",
  "track",
  "preview",
  "teaser",
  "coming",
  "out",
  "version",
  "ver",
]);

const REGION_STOPWORDS: Record<string, Set<string>> = {
  kr: new Set([
    "오늘",
    "어제",
    "내일",
    "지금",
    "이슈",
    "반응",
    "영상",
    "사진",
    "정리",
    "요약",
    "공식",
    "공개",
    "발매",
    "진행",
    "베스트",
    "조회수",
    "추천",
    "댓글",
    "실시간",
  ]),
  jp: new Set([
    "今日",
    "昨日",
    "明日",
    "速報",
    "話題",
    "反応",
    "動画",
    "画像",
    "写真",
    "公式",
    "公開",
    "発売",
    "感想",
    "まとめ",
  ]),
  cn: new Set([
    "今天",
    "昨天",
    "明天",
    "热搜",
    "话题",
    "视频",
    "图片",
    "官方",
    "发布",
    "直播",
    "网友",
    "评论",
    "整理",
    "总结",
    "热议",
  ]),
};

const CLICKBAIT_LABELS = [
  "충격",
  "섬뜩",
  "미쳤다",
  "미친",
  "만행",
  "레전드",
  "논란",
  "속보",
  "단독",
  "입수",
  "공개",
  "폭로",
  "衝撃",
  "速報",
  "緊急",
  "悲報",
  "炎上",
  "話題",
  "徹底",
  "震惊",
  "重磅",
  "独家",
  "最新",
  "热议",
];

const LABEL_SEPARATOR = String.raw`[\s:：\-|·!！？,，。.…~]+`;
const WRAPPED_LABEL = String.raw`(?:\[[^\]]*\]|\([^)]+\)|【[^】]+】)?`;
const CLICKBAIT_PATTERN = new RegExp(
  String.raw`^\s*(?:${WRAPPED_LABEL}\s*)?(?:${CLICKBAIT_LABELS.map((label) => escapeRegex(label)).join("|")})${LABEL_SEPARATOR}`,
  "iu",
);

const DIGIT_ONLY_REGEX = /^\d+$/;
const YEAR_LIKE_REGEX = /^(?:19|20)\d{2}$/;
const DATE_LIKE_REGEX = /^(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/;
const LATIN_TOKEN_REGEX = /^[a-z][a-z0-9._-]*$/;
const HANGUL_ONLY_REGEX = /^[\p{Script=Hangul}]+$/u;
const NOISE_TOKEN_REGEX = /^(?:img|jpg|jpeg|png|gif|webp|fyp|lol+|lmao|haha+|www+)$/u;
const ANALYZER_TFIDF_WINDOW_HOURS = Number(process.env.ANALYZER_TFIDF_WINDOW_HOURS ?? 168);
const ANALYZER_TFIDF_DOC_LIMIT = Number(process.env.ANALYZER_TFIDF_DOC_LIMIT ?? 8000);
const IDF_CACHE_TTL_MS = 30 * 60 * 1000;

const logger = getLogger("keyword-extractor");

interface TermIdfSnapshot {
  idfByTerm: Map<string, number>;
  genericTerms: Set<string>;
  totalDocs: number;
}

interface TermIdfCacheEntry extends TermIdfSnapshot {
  expiresAt: number;
}

interface RawPostTitleRow {
  source_id: string;
  title: string;
}

const termIdfCache = new Map<string, TermIdfCacheEntry>();
let cachedPool: Pool | null = null;

const KOREAN_SUFFIXES = [
  "에서",
  "으로",
  "에게",
  "까지",
  "부터",
  "보다",
  "처럼",
  "하고",
  "이나",
  "나",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "에",
  "의",
  "로",
  "와",
  "과",
  "도",
  "만",
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripLeadingClickbaitLabels(input: string): string {
  let current = input;
  let guard = 0;

  while (guard < 6) {
    const next = current.replace(CLICKBAIT_PATTERN, "");
    if (next === current) {
      break;
    }
    current = next.trimStart();
    guard += 1;
  }

  return current;
}

export function sanitizePostTitle(title: string, sourceId: string): string {
  const source = sourceId.toLowerCase();
  let sanitized = title.normalize("NFKC");

  sanitized = sanitized
    .replace(/【[^】]*】/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\((?:\s*)?(?:공식|official)(?:\s*)?\)/giu, " ")
    .replace(/\|\s*공식\b/giu, " ")
    .replace(/-\s*YouTube\b/giu, " ")
    .replace(/#shorts\b/giu, " ");

  if (source.startsWith("youtube_")) {
    sanitized = sanitized
      .replace(/\|\s*shorts?\b/giu, " ")
      .replace(/-\s*topic\b/giu, " ");
  }

  sanitized = sanitized
    .replace(/^[\p{Extended_Pictographic}\s~!?.:,;|/\-·•…]+/gu, "")
    .replace(/[\p{Extended_Pictographic}\s~!?.:,;|/\-·•…]+$/gu, "")
    .trim();

  sanitized = stripLeadingClickbaitLabels(sanitized);

  sanitized = sanitized
    .replace(/^[\p{Extended_Pictographic}\s~!?.:,;|/\-·•…]+/gu, "")
    .replace(/[\p{Extended_Pictographic}\s~!?.:,;|/\-·•…]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized;
}

function normalizeInputText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&[a-z0-9#]+;/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, " ");
}

function splitIntoScriptSegments(rawToken: string): string[] {
  return (
    rawToken.match(
      /[\p{Script=Hangul}]+|[\p{Script=Han}]+|[\p{Script=Hiragana}]+|[\p{Script=Katakana}]+|[a-z0-9][a-z0-9._-]*/giu,
    ) ?? []
  );
}

function normalizeCandidateToken(token: string): string {
  let normalized = token
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/[_-]{2,}/g, "-");

  if (/^[\p{Script=Hangul}]+$/u.test(normalized) && normalized.length >= 3) {
    for (const suffix of KOREAN_SUFFIXES) {
      if (normalized.endsWith(suffix) && normalized.length - suffix.length >= 2) {
        normalized = normalized.slice(0, normalized.length - suffix.length);
        break;
      }
    }
  }

  return normalized;
}

function isStopword(token: string, regionId: string): boolean {
  return BASE_STOPWORDS.has(token) || Boolean(REGION_STOPWORDS[regionId]?.has(token));
}

function shouldKeepToken(token: string, regionId: string): boolean {
  if (!token) {
    return false;
  }

  if (DIGIT_ONLY_REGEX.test(token) || NOISE_TOKEN_REGEX.test(token)) {
    return false;
  }

  if (YEAR_LIKE_REGEX.test(token) || DATE_LIKE_REGEX.test(token)) {
    return false;
  }

  const alphaNumericLength = token.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (alphaNumericLength < 2 || alphaNumericLength > 40) {
    return false;
  }

  if (LATIN_TOKEN_REGEX.test(token) && alphaNumericLength < 3) {
    return false;
  }

  if (HANGUL_ONLY_REGEX.test(token) && alphaNumericLength < 2) {
    return false;
  }

  if (isStopword(token, regionId)) {
    return false;
  }

  return true;
}

function regionScriptMultiplier(token: string, regionId: string): number {
  const hasHangul = /[\p{Script=Hangul}]/u.test(token);
  const hasJapanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(token);
  const hasHan = /[\p{Script=Han}]/u.test(token);
  const hasLatin = /[a-z]/u.test(token);

  if (regionId === "kr") {
    if (hasHangul) return 1.4;
    if (hasLatin) return 0.7;
  }

  if (regionId === "jp") {
    if (hasJapanese) return 1.4;
    if (hasLatin) return 0.72;
  }

  if (regionId === "cn") {
    if (hasHan) return 1.4;
    if (hasLatin) return 0.72;
  }

  return 1;
}

function getPoolOrNull(): Pool | null {
  if (cachedPool) {
    return cachedPool;
  }
  if (!hasPostgresConfig()) {
    return null;
  }
  cachedPool = createPostgresPool();
  return cachedPool;
}

export function buildIdfFromDocumentTokens(documentTokens: string[][]): TermIdfSnapshot {
  const docFrequency = new Map<string, number>();
  let totalDocs = 0;

  for (const tokens of documentTokens) {
    if (tokens.length === 0) {
      continue;
    }

    totalDocs += 1;
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
    }
  }

  const idfByTerm = new Map<string, number>();
  for (const [term, frequency] of docFrequency.entries()) {
    const idf = Math.log((totalDocs + 1) / (frequency + 1)) + 1;
    idfByTerm.set(term, Number(idf.toFixed(6)));
  }

  const sortedByIdfAsc = [...idfByTerm.entries()].sort((a, b) => a[1] - b[1]);
  const genericCount = Math.max(1, Math.ceil(sortedByIdfAsc.length * 0.02));
  const genericTerms = new Set(sortedByIdfAsc.slice(0, genericCount).map(([term]) => term));

  return { idfByTerm, genericTerms, totalDocs };
}

async function persistIdfCacheToDb(
  pool: Pool,
  regionId: string,
  snapshot: TermIdfSnapshot,
): Promise<void> {
  if (snapshot.idfByTerm.size === 0) {
    return;
  }

  const rows = [...snapshot.idfByTerm.entries()].slice(0, 3000);
  const values: unknown[] = [];
  const tuples: string[] = [];

  rows.forEach(([term, idf], index) => {
    const offset = index * 4;
    tuples.push(`($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4})`);
    values.push(regionId, term, idf, new Date().toISOString());
  });

  try {
    await pool.query(
      `
      insert into term_idf_cache (region_id, term, idf, computed_at)
      values ${tuples.join(",")}
      on conflict (region_id, term)
      do update set idf = excluded.idf, computed_at = excluded.computed_at
      `,
      values,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("term_idf_cache")) {
      logger.warn(`[idf-cache] persist skipped: ${message}`);
    }
  }
}

export async function computeTermIdf(regionId: string, periodHours = ANALYZER_TFIDF_WINDOW_HOURS): Promise<TermIdfSnapshot> {
  const cacheKey = `${regionId}:${periodHours}`;
  const now = Date.now();
  const cached = termIdfCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return {
      idfByTerm: new Map(cached.idfByTerm),
      genericTerms: new Set(cached.genericTerms),
      totalDocs: cached.totalDocs,
    };
  }

  const pool = getPoolOrNull();
  if (!pool) {
    return {
      idfByTerm: new Map(),
      genericTerms: new Set(),
      totalDocs: 0,
    };
  }

  const sourceIds = SOURCES.filter((source) => source.regionId === regionId).map((source) => source.id);
  if (sourceIds.length === 0) {
    return {
      idfByTerm: new Map(),
      genericTerms: new Set(),
      totalDocs: 0,
    };
  }

  const startedAt = Date.now();
  const periodStart = new Date(now - Math.max(1, periodHours) * 60 * 60 * 1000).toISOString();

  const { rows } = await pool.query<RawPostTitleRow>(
    `
    select source_id, title
    from raw_posts
    where source_id = any($1::text[])
      and collected_at >= $2
    order by collected_at desc
    limit $3
    `,
    [sourceIds, periodStart, Math.max(500, ANALYZER_TFIDF_DOC_LIMIT)],
  );

  const documentTokens = rows.map((row) => tokenizeForAnalysis(row.title, regionId, row.source_id));
  const snapshot = buildIdfFromDocumentTokens(documentTokens);

  await persistIdfCacheToDb(pool, regionId, snapshot);

  termIdfCache.set(cacheKey, {
    ...snapshot,
    expiresAt: now + IDF_CACHE_TTL_MS,
  });

  logger.info(
    `[idf-cache] region=${regionId} docs=${snapshot.totalDocs} terms=${snapshot.idfByTerm.size} generic=${snapshot.genericTerms.size} elapsedMs=${
      Date.now() - startedAt
    }`,
  );

  return {
    idfByTerm: new Map(snapshot.idfByTerm),
    genericTerms: new Set(snapshot.genericTerms),
    totalDocs: snapshot.totalDocs,
  };
}

export function tokenizeForAnalysis(text: string, regionId: string, sourceId?: string): string[] {
  const prepared = sourceId ? sanitizePostTitle(text, sourceId) : text;
  const normalized = normalizeInputText(prepared);
  const rawTokens = normalized
    .replace(/[#@]/g, " ")
    .split(/[\s,.;:!?()[\]{}"'`~…|\\/<>+=*_]+/g);

  const tokens: string[] = [];
  for (const rawToken of rawTokens) {
    if (!rawToken) {
      continue;
    }

    for (const segment of splitIntoScriptSegments(rawToken)) {
      const normalizedToken = normalizeCandidateToken(segment);
      if (!shouldKeepToken(normalizedToken, regionId)) {
        continue;
      }
      tokens.push(normalizedToken);
    }
  }

  return tokens;
}

function shouldSkipPhrase(parts: string[], regionId: string): boolean {
  if (parts.length < 2) {
    return true;
  }

  const meaningful = parts.filter((part) => !isStopword(part, regionId));
  if (meaningful.length < 2) {
    return true;
  }

  if (meaningful.some((part) => part.length < 2)) {
    return true;
  }

  return false;
}

export function buildTitlePhrases(tokens: string[], regionId: string): string[] {
  const phrases: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    for (let size = 2; size <= 4; size += 1) {
      const parts = tokens.slice(index, index + size);
      if (parts.length !== size || shouldSkipPhrase(parts, regionId)) {
        continue;
      }

      const phrase = parts.join(" ");
      if (phrase.length < 5 || phrase.length > 48) {
        continue;
      }
      phrases.push(phrase);
    }
  }

  return phrases;
}

function getEngagementWeight(post: AnalysisPostInput): number {
  const engagement =
    post.viewCount * 0.0005 +
    post.likeCount * 0.02 +
    post.commentCount * 0.015 +
    post.dislikeCount * 0.005;
  return 1 + engagement;
}

export async function extractKeywords(
  regionId: string,
  posts: AnalysisPostInput[],
): Promise<KeywordScore[]> {
  if (posts.length === 0) {
    return [];
  }

  const indexedPosts: Array<{
    post: AnalysisPostInput;
    termCounts: Map<string, number>;
    totalTerms: number;
  }> = [];
  const localDocFrequency = new Map<string, number>();

  for (const post of posts) {
    const sanitizedTitle = sanitizePostTitle(post.title, post.sourceId);
    const contentTokens = tokenizeForAnalysis(`${sanitizedTitle} ${post.bodyPreview ?? ""}`, regionId, post.sourceId);
    const titleTokens = tokenizeForAnalysis(sanitizedTitle, regionId, post.sourceId);
    const phraseTokens = buildTitlePhrases(titleTokens, regionId);
    const terms = [...contentTokens, ...phraseTokens];

    if (terms.length === 0) {
      continue;
    }

    const termCounts = new Map<string, number>();
    for (const term of terms) {
      termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
    }

    indexedPosts.push({
      post,
      termCounts,
      totalTerms: terms.length,
    });

    for (const term of termCounts.keys()) {
      localDocFrequency.set(term, (localDocFrequency.get(term) ?? 0) + 1);
    }
  }

  if (indexedPosts.length === 0) {
    return [];
  }

  const regionalIdf = await computeTermIdf(regionId, ANALYZER_TFIDF_WINDOW_HOURS);
  const regionalIdfByTerm = regionalIdf.idfByTerm;
  const genericTerms = regionalIdf.genericTerms;

  const scoreMap = new Map<string, number>();
  const postIdMap = new Map<string, Set<string>>();
  const totalDocumentCount = indexedPosts.length;

  indexedPosts.forEach(({ post, termCounts, totalTerms }) => {
    const weight = getEngagementWeight(post);
    const rankedTerms = [...termCounts.entries()]
      .map(([term, count]) => {
        if (genericTerms.has(term)) {
          return null;
        }
        const tf = count / totalTerms;
        const localDf = localDocFrequency.get(term) ?? 0;
        const localIdf = Math.log((totalDocumentCount + 1) / (localDf + 1)) + 1;
        const idf = regionalIdfByTerm.get(term) ?? localIdf;
        const phraseBoost = term.includes(" ") ? 1.55 : 1;
        const scriptBoost = regionScriptMultiplier(term, regionId);
        return [term, weight * tf * idf * phraseBoost * scriptBoost] as const;
      })
      .filter((item): item is readonly [string, number] => Boolean(item))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);

    rankedTerms.forEach(([term, weightedScore]) => {
      scoreMap.set(term, (scoreMap.get(term) ?? 0) + weightedScore);
      if (!postIdMap.has(term)) {
        postIdMap.set(term, new Set());
      }
      postIdMap.get(term)?.add(post.id);
    });
  });

  const minimumDocFrequency = indexedPosts.length >= 20 ? 2 : 1;
  const sorted = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]);
  const selectedKeywords: Array<[string, number]> = [];

  for (const [keyword, score] of sorted) {
    const hits = localDocFrequency.get(keyword) ?? 0;
    if (hits < minimumDocFrequency && !keyword.includes(" ")) {
      continue;
    }

    const isNearDuplicate = selectedKeywords.some(([picked]) => {
      const shorterLength = Math.min(picked.length, keyword.length);
      if (shorterLength < 4) {
        return false;
      }
      return picked.includes(keyword) || keyword.includes(picked);
    });

    if (isNearDuplicate) {
      continue;
    }

    selectedKeywords.push([keyword, score]);
    if (selectedKeywords.length >= 30) {
      break;
    }
  }

  return selectedKeywords.map(([keyword, score]) => ({
    keyword,
    score,
    relatedPostIds: [...(postIdMap.get(keyword) ?? new Set())],
  }));
}
