import type { Topic } from "@global-pulse/shared";
import { analyzeSentiment } from "./sentiment-analyzer";
import { calculateHeatScore } from "./heat-score-calculator";
import type { AnalysisPostInput, KeywordScore } from "./keyword-extractor";

interface ClusterOptions {
  periodStart: string;
  periodEnd: string;
}

const SOURCE_WEIGHT_MAP: Record<string, number> = {
  dcinside: 1.2,
  reddit: 1.3,
};

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
  const keywordList = keywords.map((item) => {
    const normalized = item.keyword.toLowerCase();
    keywordOriginalMap.set(normalized, item.keyword);
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

  for (const seed of keywords) {
    const seedKeyword = seed.keyword.toLowerCase();
    if (usedKeywords.has(seedKeyword)) {
      continue;
    }

    const seedPosts = keywordPostMap.get(seedKeyword) ?? new Set<string>();
    if (seedPosts.size === 0) {
      continue;
    }

    const clusterKeywords = [seedKeyword];

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

      if (overlap >= 2) {
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

    clusteredTopics.push({
      regionId,
      nameKo: seed.keyword,
      nameEn: seed.keyword,
      keywords: clusterKeywords.map((keyword) => keywordOriginalMap.get(keyword) ?? keyword),
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

    clusterKeywords.forEach((keyword) => usedKeywords.add(keyword));
  }

  return clusteredTopics
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 15)
    .map((topic, index) => ({
      ...topic,
      rank: index + 1,
    }));
}

