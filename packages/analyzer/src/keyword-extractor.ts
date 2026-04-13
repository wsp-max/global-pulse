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
  "rt",
  "users",
  "user",
  "debate",
  "sparks",
  "across",
  "multiple",
  "community",
  "communities",
  "latest",
  "watch",
  "report",
  "says",
  "said",
  "new",
  "more",
]);

const REGION_STOPWORDS: Record<string, Set<string>> = {
  kr: new Set([
    "오늘",
    "어제",
    "지금",
    "관련",
    "이슈",
    "논란",
    "반응",
    "현황",
    "뉴스",
    "영상",
    "사진",
    "속보",
    "공식",
    "정리",
    "요약",
    "근황",
    "진짜",
    "그냥",
    "이번",
    "진행",
    "그리고",
    "하는",
    "있는",
    "없는",
  ]),
  jp: new Set([
    "これ",
    "それ",
    "ため",
    "よう",
    "こと",
    "さん",
    "ます",
    "です",
    "する",
    "した",
    "して",
    "ない",
    "ある",
    "いる",
    "最新",
    "速報",
    "まとめ",
  ]),
  cn: new Set([
    "这个",
    "那个",
    "我们",
    "你们",
    "他们",
    "今天",
    "昨天",
    "现在",
    "已经",
    "还是",
    "不是",
    "可以",
    "一个",
    "一下",
    "视频",
    "网友",
    "评论",
    "热搜",
  ]),
};

const HANGUL_ONLY_REGEX = /^[\p{Script=Hangul}]+$/u;
const LATIN_TOKEN_REGEX = /^[a-z][a-z0-9._-]*$/;
const DIGIT_ONLY_REGEX = /^\d+$/;
const NOISE_TOKEN_REGEX = /^(?:img|jpg|jpeg|png|gif|webp|v\d+|fyp)$/;
const KOREAN_SUFFIXES = [
  "에서는",
  "으로는",
  "으로도",
  "에게서",
  "으로",
  "에서",
  "에게",
  "한테",
  "까지",
  "부터",
  "보다",
  "처럼",
  "이랑",
  "하고",
  "와",
  "과",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "에",
  "도",
  "만",
  "로",
  "의",
];

function normalizeInputText(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&[a-z0-9#]+;/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, " ");
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

function splitIntoScriptSegments(rawToken: string): string[] {
  return (
    rawToken.match(
      /[\p{Script=Hangul}]+|[\p{Script=Han}]+|[\p{Script=Hiragana}]+|[\p{Script=Katakana}]+|[a-z0-9][a-z0-9._-]*/giu,
    ) ?? []
  );
}

function isStopword(token: string, regionId: string): boolean {
  return BASE_STOPWORDS.has(token) || Boolean(REGION_STOPWORDS[regionId]?.has(token));
}

function regionScriptMultiplier(token: string, regionId: string): number {
  const hasHangul = /[\p{Script=Hangul}]/u.test(token);
  const hasJapanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(token);
  const hasHan = /[\p{Script=Han}]/u.test(token);
  const hasLatin = /[a-z]/u.test(token);

  if (regionId === "kr") {
    if (hasHangul) return 1.45;
    if (hasLatin) return 0.65;
  }

  if (regionId === "jp") {
    if (hasJapanese) return 1.45;
    if (hasLatin) return 0.7;
  }

  if (regionId === "cn") {
    if (hasHan) return 1.45;
    if (hasLatin) return 0.7;
  }

  return 1;
}

function shouldKeepToken(token: string, regionId: string): boolean {
  if (!token) {
    return false;
  }

  if (DIGIT_ONLY_REGEX.test(token) || NOISE_TOKEN_REGEX.test(token)) {
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

export function tokenizeForAnalysis(text: string, regionId: string): string[] {
  const normalized = normalizeInputText(text);
  const rawTokens = normalized
    .replace(/[#@]/g, " ")
    .split(/[\s,.;:!?()[\]{}"“”'’`~!$%^&*+=<>|\\/]+/g);

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
    for (let size = 2; size <= 3; size += 1) {
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
  const docFrequency = new Map<string, number>();

  for (const post of posts) {
    const contentTokens = tokenizeForAnalysis(`${post.title} ${post.bodyPreview ?? ""}`, regionId);
    const titleTokens = tokenizeForAnalysis(post.title, regionId);
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
      docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
    }
  }

  if (indexedPosts.length === 0) {
    return [];
  }

  const scoreMap = new Map<string, number>();
  const postIdMap = new Map<string, Set<string>>();
  const totalDocumentCount = indexedPosts.length;

  indexedPosts.forEach(({ post, termCounts, totalTerms }) => {
    const weight = getEngagementWeight(post);
    const rankedTerms = [...termCounts.entries()]
      .map(([term, count]) => {
        const tf = count / totalTerms;
        const df = docFrequency.get(term) ?? 0;
        const idf = Math.log((totalDocumentCount + 1) / (df + 1)) + 1;
        const phraseBoost = term.includes(" ") ? 1.55 : 1;
        const scriptBoost = regionScriptMultiplier(term, regionId);
        return [term, tf * idf * weight * phraseBoost * scriptBoost] as const;
      })
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
    const hits = docFrequency.get(keyword) ?? 0;
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
