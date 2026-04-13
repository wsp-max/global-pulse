import natural from "natural";

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

const STOPWORDS = new Set([
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
  "kr",
  "co",
  "amp",
  "입니다",
  "그리고",
  "하지만",
  "에서",
  "으로",
  "하는",
  "했다",
  "있는",
  "대한",
  "관련",
  "오늘",
  "이번",
  "그냥",
  "진짜",
  "정말",
  "ㅋㅋ",
  "ㅋㅋㅋ",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
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
  _regionId: string,
  posts: AnalysisPostInput[],
): Promise<KeywordScore[]> {
  if (posts.length === 0) {
    return [];
  }

  const tfidf = new natural.TfIdf();
  const indexedPosts: AnalysisPostInput[] = [];

  for (const post of posts) {
    const tokens = tokenize(`${post.title} ${post.bodyPreview ?? ""}`);
    if (tokens.length === 0) {
      continue;
    }
    tfidf.addDocument(tokens.join(" "));
    indexedPosts.push(post);
  }

  if (indexedPosts.length === 0) {
    return [];
  }

  const scoreMap = new Map<string, number>();
  const postIdMap = new Map<string, Set<string>>();

  indexedPosts.forEach((post, index) => {
    const weight = getEngagementWeight(post);
    tfidf.listTerms(index).slice(0, 25).forEach((term) => {
      const adjustedScore = term.tfidf * weight;
      scoreMap.set(term.term, (scoreMap.get(term.term) ?? 0) + adjustedScore);
      if (!postIdMap.has(term.term)) {
        postIdMap.set(term.term, new Set());
      }
      postIdMap.get(term.term)?.add(post.id);
    });
  });

  return [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([keyword, score]) => ({
      keyword,
      score,
      relatedPostIds: [...(postIdMap.get(keyword) ?? new Set())],
    }));
}

