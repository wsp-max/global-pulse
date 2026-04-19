import type { Topic } from "@global-pulse/shared";
import { analyzeSentiment } from "./sentiment-analyzer";
import { calculateHeatScoreWithSourceDiversity } from "./heat-score-calculator";
import {
  buildTitlePhrases,
  sanitizePostTitle,
  tokenizeForAnalysis,
  type AnalysisPostInput,
  type KeywordScore,
} from "./keyword-extractor";

interface ClusterOptions {
  periodStart: string;
  periodEnd: string;
}

const ANALYZER_MAX_TOPICS = Number(process.env.ANALYZER_MAX_TOPICS ?? 20);
const ANALYZER_MAX_SINGLE_POST_TOPICS = Number(process.env.ANALYZER_MAX_SINGLE_POST_TOPICS ?? 8);
const ANALYZER_SINGLE_POST_SEED_MIN_KEYWORDS = Number(
  process.env.ANALYZER_SINGLE_POST_SEED_MIN_KEYWORDS ?? 20,
);

const SOURCE_WEIGHT_MAP: Record<string, number> = {
  dcinside: 1.2,
  reddit: 1.3,
  reddit_worldnews: 1.25,
  reddit_europe: 1.15,
  reddit_eu_union: 1.15,
  reddit_askuk: 1.05,
  reddit_greek: 1.0,
  reddit_germany: 1.1,
  reddit_france: 1.1,
  reddit_mideast: 1.15,
  reddit_mideast_arabic: 1.1,
  reddit_pakistan: 1.0,
  reddit_israel: 1.0,
  reddit_iran: 1.1,
  fourchan: 0.95,
  hackernews: 1.1,
  reddit_korea: 1.2,
  reddit_korea_opentalk: 1.0,
  inven: 1.1,
  instiz: 1.05,
  arca: 0.95,
  reddit_japan: 1.12,
  reddit_japan_politics: 1.08,
  reddit_japan_tech: 1.05,
  reddit_japanese: 1.08,
  yahoo_japan: 1.08,
  girlschannel: 1.0,
  togetter: 1.02,
  reddit_taiwan: 1.05,
  reddit_taiwanese: 1.0,
  reddit_hongkong: 1.0,
  reddit_taiwan_tech: 1.0,
  bahamut: 1.05,
  mobile01: 0.95,
  reddit_china: 1.0,
  tieba: 1.08,
  reddit_science: 1.15,
  reddit_russia: 1.05,
  reddit_russian: 1.0,
  reddit_ukraine: 1.0,
  habr: 1.08,
  slashdot: 1.05,
  fark: 0.92,
  resetera: 1.0,
  gutefrage: 0.95,
  mumsnet: 0.95,
  youtube_kr: 0.45,
  youtube_jp: 0.45,
  youtube_us: 0.45,
  youtube_me: 0.45,
  youtube_ru: 0.45,
  mastodon: 0.8,
  mastodon_me: 0.82,
  mastodon_ru: 0.82,
  bilibili: 0.8,
};

const TOPIC_NAME_BLACKLIST = new Set([
  "news",
  "issue",
  "topic",
  "update",
  "video",
  "videos",
  "shorts",
  "official",
  "breaking",
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
  "channel",
  "follow",
  "group",
  "final",
  "people",
  "not",
  "you",
  "your",
  "what",
  "who",
  "when",
  "where",
  "why",
  "how",
  "\uC624\uB298",
  "\uC5B4\uC81C",
  "\uC9C0\uAE08",
  "\uC774\uC288",
  "\uC601\uC0C1",
  "\uC0AC\uC9C4",
  "\uC815\uB9AC",
  "\uC694\uC57D",
  "\uC870\uD68C\uC218",
  "\uCD94\uCC9C",
  "\uBC18\uC751",
  "\uACF5\uC2DD",
  "\u4ECA\u65E5",
  "\u6628\u65E5",
  "\u8A71\u984C",
  "\u52D5\u753B",
  "\u753B\u50CF",
  "\u5199\u771F",
  "\u611F\u60F3",
  "\u307E\u3068\u3081",
  "\u516C\u5F0F",
  "\u4ECA\u5929",
  "\u6628\u5929",
  "\u8BDD\u9898",
  "\u89C6\u9891",
  "\u56FE\u7247",
  "\u8BC4\u8BBA",
  "\u5B98\u65B9",
  "\u5B9E\u65F6",
  "\u70ED\u8BAE",
  "\u65B0\u7740",
  "\u8A0E\u8AD6",
  "\u56DE\u8986",
  "\uB313\uAE00",
  "\uC2E4\uC2DC\uAC04",
  "\uD56B",
  "\u65B0\u89C4",
  "hot",
  "new",
  "thread",
  "threads",
  "post",
  "posts",
  "comment",
  "comments",
  "reply",
  "replies",
  "answer",
  "answers",
  "antwort",
  "antworten",
  "frage",
  "fragen",
  "diskussion",
]);

const LOW_SIGNAL_LABEL_PARTS = new Set([
  "official",
  "video",
  "videos",
  "music",
  "mv",
  "trailer",
  "teaser",
  "teasers",
  "preview",
  "clip",
  "audio",
  "lyric",
  "lyrics",
  "director",
  "credits",
  "credit",
  "producer",
  "production",
  "release",
  "released",
  "stream",
  "channel",
  "follow",
  "group",
  "season",
  "episode",
  "part",
  "full",
  "complete",
  "keep",
  "alive",
  "dance",
  "practice",
  "version",
  "ver",
  "provided",
  "performance",
  "stage",
  "watch",
  "topic",
  "topics",
  "thread",
  "threads",
  "post",
  "posts",
  "comment",
  "comments",
  "reply",
  "replies",
  "answer",
  "answers",
  "frage",
  "fragen",
  "hot",
  "new",
  "update",
]);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesKeyword(text: string, keyword: string): boolean {
  return text.includes(keyword.toLowerCase());
}

function parsePostTimestamp(postedAt: string | undefined): Date | null {
  if (!postedAt) return null;
  const parsed = new Date(postedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sourceWeight(sourceId: string): number {
  return SOURCE_WEIGHT_MAP[sourceId] ?? 1;
}

function getEngagementWeight(post: AnalysisPostInput): number {
  return (
    1 +
    post.viewCount * 0.0005 +
    post.likeCount * 0.02 +
    post.commentCount * 0.015 +
    post.dislikeCount * 0.005
  );
}

function normalizeTopicLabel(value: string): string {
  return value
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]+\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSingleTokenLabel(value: string): boolean {
  return !value.includes(" ");
}

function splitLabelParts(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s/|,:;+\-–—]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isLowSignalLabelPart(value: string): boolean {
  return TOPIC_NAME_BLACKLIST.has(value) || LOW_SIGNAL_LABEL_PARTS.has(value);
}

function countMeaningfulLabelParts(value: string): number {
  return splitLabelParts(value).filter((part) => !isLowSignalLabelPart(part) && !/^\d+$/u.test(part)).length;
}

function getPhraseOverlap(left: string, right: string): { total: number; meaningful: number } {
  const leftParts = new Set(splitLabelParts(left));
  const rightParts = new Set(splitLabelParts(right));
  let total = 0;
  let meaningful = 0;

  for (const part of leftParts) {
    if (!rightParts.has(part)) {
      continue;
    }

    total += 1;
    if (!isLowSignalLabelPart(part)) {
      meaningful += 1;
    }
  }

  return { total, meaningful };
}

function isMeaningfulTopicLabel(value: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = normalizeTopicLabel(value);
  if (!normalized) {
    return false;
  }

  const compact = normalized.replace(/\s+/g, "");
  if (compact.length < 3 || compact.length > 42) {
    return false;
  }

  if (/^\d+$/u.test(compact)) {
    return false;
  }

  const normalizedLower = normalized.toLowerCase();
  if (TOPIC_NAME_BLACKLIST.has(normalizedLower)) {
    return false;
  }

  const labelParts = splitLabelParts(normalized);
  const meaningfulPartCount = countMeaningfulLabelParts(normalized);
  if (labelParts.length > 0 && meaningfulPartCount === 0) {
    return false;
  }

  const letterCount = (compact.match(/\p{L}/gu) ?? []).length;
  if (letterCount < 2) {
    return false;
  }

  if (/^[a-z0-9._-]+$/u.test(compact) && compact.length < 5) {
    return false;
  }

  if (isSingleTokenLabel(normalized) && /^[\p{Script=Hangul}]+$/u.test(compact) && compact.length < 3) {
    return false;
  }

  if (
    isSingleTokenLabel(normalized) &&
    /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(compact) &&
    compact.length < 2
  ) {
    return false;
  }

  if (isSingleTokenLabel(normalized) && /^[a-z0-9._-]+$/u.test(compact) && compact.length < 7) {
    return false;
  }

  if (isSingleTokenLabel(normalized) && isLowSignalLabelPart(normalizedLower)) {
    return false;
  }

  if (!isSingleTokenLabel(normalized) && /^[a-z0-9\s./|:_-]+$/u.test(normalizedLower)) {
    if (labelParts.length <= 2 && meaningfulPartCount < 2) {
      return false;
    }

    if (labelParts.length >= 3 && meaningfulPartCount < 1) {
      return false;
    }
  }

  return true;
}

function combineTopicLabels(primary: string, secondary: string): string | null {
  const normalizedPrimary = normalizeTopicLabel(primary);
  const normalizedSecondary = normalizeTopicLabel(secondary);
  if (!normalizedPrimary || !normalizedSecondary) {
    return null;
  }

  const lowerPrimary = normalizedPrimary.toLowerCase();
  const lowerSecondary = normalizedSecondary.toLowerCase();
  if (lowerPrimary === lowerSecondary) {
    return null;
  }

  if (lowerPrimary.includes(lowerSecondary) || lowerSecondary.includes(lowerPrimary)) {
    return null;
  }

  const combined = `${normalizedPrimary} / ${normalizedSecondary}`;
  if (combined.replace(/\s+/g, "").length > 42) {
    return null;
  }

  return combined;
}

function scoreCandidate(map: Map<string, number>, label: string, score: number): void {
  const normalized = normalizeTopicLabel(label);
  if (!normalized || !isMeaningfulTopicLabel(normalized)) {
    return;
  }

  const adjustedScore = isSingleTokenLabel(normalized) ? score * 0.4 : score;
  map.set(normalized, (map.get(normalized) ?? 0) + adjustedScore);
}

function buildFallbackTopicName(
  clusterKeywords: string[],
  keywordOriginalMap: Map<string, string>,
  keywordScoreMap: Map<string, number>,
): string {
  const candidates = [...new Set(clusterKeywords)]
    .map((normalizedKeyword) => ({
      label: keywordOriginalMap.get(normalizedKeyword) ?? normalizedKeyword,
      score: keywordScoreMap.get(normalizedKeyword) ?? 0,
    }))
    .filter((item) => isMeaningfulTopicLabel(item.label))
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return "topic signal";
  }

  if (candidates.length === 1) {
    return normalizeTopicLabel(candidates[0]!.label);
  }

  const combined = `${candidates[0]!.label} / ${candidates[1]!.label}`;
  if (combined.replace(/\s+/g, "").length <= 42) {
    return combined;
  }

  return normalizeTopicLabel(candidates[0]!.label);
}

function buildRepresentativeTopicName(params: {
  regionId: string;
  relatedPosts: AnalysisPostInput[];
  clusterKeywords: string[];
  keywordOriginalMap: Map<string, string>;
  keywordScoreMap: Map<string, number>;
}): string {
  const { regionId, relatedPosts, clusterKeywords, keywordOriginalMap, keywordScoreMap } = params;
  const candidateScores = new Map<string, number>();

  for (const post of relatedPosts) {
    const weight = getEngagementWeight(post);
    const sanitizedTitle = sanitizePostTitle(post.title, post.sourceId);
    const titleTokens = tokenizeForAnalysis(sanitizedTitle, regionId, post.sourceId);
    const phrases = buildTitlePhrases(titleTokens, regionId);

    for (const token of titleTokens.slice(0, 8)) {
      scoreCandidate(candidateScores, token, weight * 0.75);
    }

    for (const phrase of phrases) {
      scoreCandidate(candidateScores, phrase, weight * 1.35);
    }
  }

  for (const clusterKeyword of clusterKeywords) {
    const original = keywordOriginalMap.get(clusterKeyword) ?? clusterKeyword;
    const baseScore = keywordScoreMap.get(clusterKeyword) ?? 1;
    const phraseBoost = original.includes(" ") ? 2.9 : 1.15;
    scoreCandidate(candidateScores, original, baseScore * phraseBoost);
  }

  const ranked = [...candidateScores.entries()].sort((a, b) => {
    const aBoost = a[0].includes(" ") ? 0.35 : 0;
    const bBoost = b[0].includes(" ") ? 0.35 : 0;
    return b[1] + bBoost - (a[1] + aBoost);
  });

  const bestPhrase = ranked.find(([label]) => label.includes(" ") && isMeaningfulTopicLabel(label));
  if (bestPhrase) {
    return normalizeTopicLabel(bestPhrase[0]);
  }

  const bestSingle = ranked.find(([label]) => isSingleTokenLabel(label) && isMeaningfulTopicLabel(label));
  if (bestSingle) {
    const primary = normalizeTopicLabel(bestSingle[0]);
    const secondary = ranked
      .map(([label]) => normalizeTopicLabel(label))
      .find((label) => label && label !== primary && isMeaningfulTopicLabel(label));

    if (secondary) {
      const combined = combineTopicLabels(primary, secondary);
      if (combined) {
        return combined;
      }
    }

    return primary;
  }

  return buildFallbackTopicName(clusterKeywords, keywordOriginalMap, keywordScoreMap);
}

function hasLatinText(value: string): boolean {
  return /[a-z]/iu.test(value);
}

function hasKoreanOrCjkText(value: string): boolean {
  return /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
}

function sanitizeEnglishPhrase(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^a-z0-9/&+.\- ]/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((part) => (part.length > 0 ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function buildEnglishTopicName(topicName: string, keywords: string[], regionId: string, index: number): string {
  if (hasLatinText(topicName) || !hasKoreanOrCjkText(topicName)) {
    return topicName;
  }

  const keywordCandidate = keywords
    .map((keyword) => sanitizeEnglishPhrase(keyword))
    .find((candidate) => candidate && hasLatinText(candidate) && candidate.length >= 3);

  if (keywordCandidate) {
    return titleCase(keywordCandidate);
  }

  return `Region ${regionId.toUpperCase()} Topic ${index + 1}`;
}

export async function clusterTopics(
  regionId: string,
  keywords: KeywordScore[],
  posts: AnalysisPostInput[],
  options: ClusterOptions,
): Promise<Topic[]> {
  if (keywords.length === 0 || posts.length === 0) {
    return [];
  }

  const normalizedPostMap = new Map<string, { post: AnalysisPostInput; normalizedText: string }>();

  for (const post of posts) {
    const sanitizedTitle = sanitizePostTitle(post.title, post.sourceId);
    const tokenizedText = tokenizeForAnalysis(
      `${sanitizedTitle} ${post.bodyPreview ?? ""}`,
      regionId,
      post.sourceId,
    ).join(" ");
    normalizedPostMap.set(post.id, {
      post,
      normalizedText: `${normalizeText(`${sanitizedTitle} ${post.bodyPreview ?? ""}`)} ${tokenizedText}`.trim(),
    });
  }

  const keywordOriginalMap = new Map<string, string>();
  const keywordScoreMap = new Map<string, number>();
  const keywordList = keywords.map((item) => {
    const normalized = item.keyword.toLowerCase();
    keywordOriginalMap.set(normalized, item.keyword);
    keywordScoreMap.set(normalized, item.score);
    return normalized;
  });

  const keywordPostMap = new Map<string, Set<string>>();
  for (const keyword of keywordList) {
    keywordPostMap.set(keyword, new Set());
  }

  for (const { post, normalizedText } of normalizedPostMap.values()) {
    for (const keyword of keywordList) {
      if (includesKeyword(normalizedText, keyword)) {
        keywordPostMap.get(keyword)?.add(post.id);
      }
    }
  }

  const usedKeywords = new Set<string>();
  const clusteredTopics: Topic[] = [];
  const topKeywordScore = keywords[0]?.score ?? 0;
  const singlePostScoreThreshold = topKeywordScore * 0.35;
  let singlePostTopicCount = 0;

  for (const seed of keywords) {
    const seedKeyword = seed.keyword.toLowerCase();
    if (usedKeywords.has(seedKeyword)) {
      continue;
    }

    const seedPosts = keywordPostMap.get(seedKeyword) ?? new Set<string>();
    if (seedPosts.size === 0) {
      continue;
    }

    const isPhraseSeed = seed.keyword.includes(" ");
    if (!isPhraseSeed && seedPosts.size < 2 && keywords.length >= ANALYZER_SINGLE_POST_SEED_MIN_KEYWORDS) {
      continue;
    }

    if (seedPosts.size < 2 && seed.score < singlePostScoreThreshold) {
      continue;
    }

    const clusterKeywords = [seedKeyword];
    const requiredOverlap = seedPosts.size === 1 ? 1 : seedPosts.size >= 20 ? 3 : 2;

    for (const candidate of keywords) {
      const candidateKeyword = candidate.keyword.toLowerCase();
      if (candidateKeyword === seedKeyword || usedKeywords.has(candidateKeyword)) {
        continue;
      }

      const candidatePosts = keywordPostMap.get(candidateKeyword) ?? new Set<string>();
      if (candidatePosts.size === 0) {
        continue;
      }

      let overlap = 0;
      for (const postId of candidatePosts) {
        if (seedPosts.has(postId)) {
          overlap += 1;
        }
      }

      const phraseOverlap =
        seedKeyword.includes(" ") && candidateKeyword.includes(" ")
          ? getPhraseOverlap(seedKeyword, candidateKeyword)
          : { total: 0, meaningful: 0 };

      const hasPhraseSimilarity =
        phraseOverlap.meaningful >= 2 || (phraseOverlap.meaningful >= 1 && phraseOverlap.total >= 3);

      if (overlap >= requiredOverlap || hasPhraseSimilarity) {
        clusterKeywords.push(candidateKeyword);
      }

      if (clusterKeywords.length >= 5) {
        break;
      }
    }

    const relatedPostIds = new Set<string>();
    for (const keyword of clusterKeywords) {
      const ids = keywordPostMap.get(keyword) ?? new Set<string>();
      for (const postId of ids) {
        relatedPostIds.add(postId);
      }
    }

    if (relatedPostIds.size === 0) {
      continue;
    }

    const relatedPosts = [...relatedPostIds]
      .map((id) => normalizedPostMap.get(id)?.post)
      .filter((post): post is AnalysisPostInput => Boolean(post));

    const hasPhraseKeyword = clusterKeywords.some((keyword) => keyword.includes(" "));

    if (relatedPosts.length < 2 && singlePostTopicCount >= ANALYZER_MAX_SINGLE_POST_TOPICS) {
      continue;
    }

    if (relatedPosts.length === 1 && clusterKeywords.length < 2 && !hasPhraseKeyword) {
      continue;
    }

    const now = new Date();
    const heatInputs = relatedPosts.map((post) => {
      const postedAt =
        parsePostTimestamp(post.postedAt ?? undefined) ?? parsePostTimestamp(post.collectedAt ?? undefined);
      const hoursSince = postedAt
        ? Math.max(0, (now.getTime() - postedAt.getTime()) / (1000 * 60 * 60))
        : 0;

      return {
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        dislikeCount: post.dislikeCount,
        hoursSincePosted: hoursSince,
        sourceWeight: sourceWeight(post.sourceId),
      };
    });

    const sentiments = relatedPosts
      .map((post) => analyzeSentiment(`${post.title} ${post.bodyPreview ?? ""}`))
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const avgSentiment =
      sentiments.length > 0 ? sentiments.reduce((sum, value) => sum + value, 0) / sentiments.length : null;

    const sourceIds = [...new Set(relatedPosts.map((post) => post.sourceId))];
    const topicKeywords = [...new Set(clusterKeywords.map((keyword) => keywordOriginalMap.get(keyword) ?? keyword))];
    const topicName = buildRepresentativeTopicName({
      regionId,
      relatedPosts,
      clusterKeywords,
      keywordOriginalMap,
      keywordScoreMap,
    });
    const topicNameEn = buildEnglishTopicName(topicName, topicKeywords, regionId, clusteredTopics.length);

    if (isSingleTokenLabel(topicName) && (relatedPosts.length < 3 || clusterKeywords.length < 2)) {
      continue;
    }

    if (!isMeaningfulTopicLabel(topicName)) {
      continue;
    }

    clusteredTopics.push({
      regionId,
      nameKo: topicName,
      nameEn: topicNameEn,
      sampleTitles: relatedPosts
        .slice(0, 5)
        .map((post) => sanitizePostTitle(post.title, post.sourceId))
        .filter((title) => title.length > 0),
      keywords: topicKeywords,
      sentiment: avgSentiment === null ? null : Number(avgSentiment.toFixed(3)),
      heatScore: calculateHeatScoreWithSourceDiversity(heatInputs, {
        sourceDiversityCount: sourceIds.length,
      }),
      postCount: relatedPosts.length,
      totalViews: relatedPosts.reduce((sum, post) => sum + post.viewCount, 0),
      totalLikes: relatedPosts.reduce((sum, post) => sum + post.likeCount, 0),
      totalComments: relatedPosts.reduce((sum, post) => sum + post.commentCount, 0),
      sourceIds,
      rawPostIds: relatedPosts
        .map((post) => Number(post.id))
        .filter((postId) => Number.isInteger(postId) && postId > 0),
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
    });

    if (relatedPosts.length < 2) {
      singlePostTopicCount += 1;
    }

    clusterKeywords.forEach((keyword) => usedKeywords.add(keyword));
  }

  const ranked = clusteredTopics.sort((a, b) => b.heatScore - a.heatScore);
  const deduped: Topic[] = [];

  for (const topic of ranked) {
    const normalized = topic.nameEn.toLowerCase().replace(/\s+/g, " ").trim();
    const isDuplicate = deduped.some((existing) => {
      const existingNormalized = existing.nameEn.toLowerCase().replace(/\s+/g, " ").trim();
      if (existingNormalized === normalized) {
        return true;
      }

      const shorterLength = Math.min(existingNormalized.length, normalized.length);
      if (shorterLength < 5) {
        return false;
      }

      return existingNormalized.includes(normalized) || normalized.includes(existingNormalized);
    });

    if (isDuplicate) {
      continue;
    }

    deduped.push(topic);
    if (deduped.length >= ANALYZER_MAX_TOPICS) {
      break;
    }
  }

  return deduped.map((topic, index) => ({
    ...topic,
    rank: index + 1,
  }));
}
