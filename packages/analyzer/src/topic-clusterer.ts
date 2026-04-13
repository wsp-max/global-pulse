import type { Topic } from "@global-pulse/shared";
import { analyzeSentiment } from "./sentiment-analyzer";
import { calculateHeatScore } from "./heat-score-calculator";
import {
  buildTitlePhrases,
  tokenizeForAnalysis,
  type AnalysisPostInput,
  type KeywordScore,
} from "./keyword-extractor";

interface ClusterOptions {
  periodStart: string;
  periodEnd: string;
}

const SOURCE_WEIGHT_MAP: Record<string, number> = {
  dcinside: 1.2,
  reddit: 1.3,
};

const TOPIC_NAME_BLACKLIST = new Set([
  "news",
  "issue",
  "topic",
  "update",
  "video",
  "shorts",
  "official",
  "breaking",
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

  if (TOPIC_NAME_BLACKLIST.has(normalized.toLowerCase())) {
    return false;
  }

  const letterCount = (compact.match(/\p{L}/gu) ?? []).length;
  if (letterCount < 2) {
    return false;
  }

  if (/^[a-z0-9._-]+$/u.test(compact) && compact.length < 5) {
    return false;
  }

  return true;
}

function scoreCandidate(
  map: Map<string, number>,
  label: string,
  score: number,
): void {
  const normalized = normalizeTopicLabel(label);
  if (!normalized || !isMeaningfulTopicLabel(normalized)) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + score);
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

  const combined = `${candidates[0]!.label} · ${candidates[1]!.label}`;
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
    const titleTokens = tokenizeForAnalysis(post.title, regionId);
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
    const phraseBoost = original.includes(" ") ? 2.4 : 1.2;
    scoreCandidate(candidateScores, original, baseScore * phraseBoost);
  }

  const ranked = [...candidateScores.entries()].sort((a, b) => {
    const aBoost = a[0].includes(" ") ? 0.35 : 0;
    const bBoost = b[0].includes(" ") ? 0.35 : 0;
    return b[1] + bBoost - (a[1] + aBoost);
  });

  const best = ranked.find(([label]) => isMeaningfulTopicLabel(label));
  if (best) {
    return normalizeTopicLabel(best[0]);
  }

  return buildFallbackTopicName(clusterKeywords, keywordOriginalMap, keywordScoreMap);
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

  const normalizedPostMap = new Map<
    string,
    { post: AnalysisPostInput; normalizedText: string }
  >();

  for (const post of posts) {
    normalizedPostMap.set(post.id, {
      post,
      normalizedText: normalizeText(`${post.title} ${post.bodyPreview ?? ""}`),
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
    if (!isPhraseSeed && seedPosts.size < 2 && keywords.length >= 12) {
      continue;
    }

    if (seedPosts.size < 2 && seed.score < singlePostScoreThreshold) {
      continue;
    }

    const clusterKeywords = [seedKeyword];
    const requiredOverlap = seedPosts.size >= 20 ? 3 : 2;

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

      if (overlap >= requiredOverlap) {
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

    if (relatedPosts.length < 2 && singlePostTopicCount >= 4) {
      continue;
    }

    const now = new Date();
    const heatInputs = relatedPosts.map((post) => {
      const postedAt =
        parsePostTimestamp(post.postedAt ?? undefined) ??
        parsePostTimestamp(post.collectedAt ?? undefined);
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

    const sentiments = relatedPosts.map((post) =>
      analyzeSentiment(`${post.title} ${post.bodyPreview ?? ""}`),
    );

    const avgSentiment =
      sentiments.length > 0
        ? sentiments.reduce((sum, value) => sum + value, 0) / sentiments.length
        : 0;

    const sourceIds = [...new Set(relatedPosts.map((post) => post.sourceId))];
    const topicKeywords = [...new Set(clusterKeywords.map((keyword) => keywordOriginalMap.get(keyword) ?? keyword))];
    const topicName = buildRepresentativeTopicName({
      regionId,
      relatedPosts,
      clusterKeywords,
      keywordOriginalMap,
      keywordScoreMap,
    });

    clusteredTopics.push({
      regionId,
      nameKo: topicName,
      nameEn: topicName,
      keywords: topicKeywords,
      sentiment: Number(avgSentiment.toFixed(3)),
      heatScore: calculateHeatScore(heatInputs),
      postCount: relatedPosts.length,
      totalViews: relatedPosts.reduce((sum, post) => sum + post.viewCount, 0),
      totalLikes: relatedPosts.reduce((sum, post) => sum + post.likeCount, 0),
      totalComments: relatedPosts.reduce((sum, post) => sum + post.commentCount, 0),
      sourceIds,
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
    if (deduped.length >= 15) {
      break;
    }
  }

  return deduped.map((topic, index) => ({
    ...topic,
    rank: index + 1,
  }));
}
