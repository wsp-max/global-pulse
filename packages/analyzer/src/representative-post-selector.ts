import type { AnalysisPostInput } from "./keyword-extractor";

export interface RepresentativeExcerpt {
  title: string;
  snippetFirstSentence: string;
  url: string | null;
  sourceId: string;
  publishedAt: string | null;
}

function cleanSnippet(input: string | null | undefined): string {
  const text = (input ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  const sentence = text.split(/(?<=[.!?。！？])\s+/u)[0]?.trim() ?? text;
  const clipped = sentence.slice(0, 200).trim();
  return clipped;
}

function engagementScore(post: AnalysisPostInput): number {
  return (
    Math.log(post.viewCount + 1) * 0.3 +
    Math.log(post.likeCount + 1) * 0.4 +
    Math.log(post.commentCount + 1) * 0.3
  );
}

export function selectRepresentativeExcerpts(
  posts: AnalysisPostInput[],
  options?: { limit?: number },
): RepresentativeExcerpt[] {
  const limit = Math.min(Math.max(options?.limit ?? 3, 1), 3);

  const ranked = [...posts]
    .filter((post) => post.title.trim().length > 0)
    .sort((left, right) => engagementScore(right) - engagementScore(left));

  const excerpts: RepresentativeExcerpt[] = [];
  for (const post of ranked) {
    if (excerpts.length >= limit) {
      break;
    }

    excerpts.push({
      title: post.title.trim().slice(0, 140),
      snippetFirstSentence: cleanSnippet(post.bodyPreview),
      url: null,
      sourceId: post.sourceId,
      publishedAt: post.postedAt ?? post.collectedAt ?? null,
    });
  }

  return excerpts;
}

