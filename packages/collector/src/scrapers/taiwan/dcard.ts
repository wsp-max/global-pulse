import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const DCARD_POPULAR_POSTS_URL = "https://www.dcard.tw/service/api/v2/posts?popular=true&limit=30";

interface DcardPost {
  id?: number | string;
  title?: string;
  excerpt?: string;
  forumAlias?: string;
  createdAt?: string;
  likeCount?: number;
  commentCount?: number;
  reactions?: Array<{ count?: number }>;
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toExternalId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toUrl(post: DcardPost, externalId: string): string {
  const forumAlias = cleanText(post.forumAlias);
  if (forumAlias) {
    return `https://www.dcard.tw/f/${forumAlias}/p/${externalId}`;
  }
  return `https://www.dcard.tw/f/p/${externalId}`;
}

export class DcardScraper extends BaseScraper {
  sourceId = "dcard";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<DcardPost[] | string>(DCARD_POPULAR_POSTS_URL, {
      responseType: "json",
      headers: {
        Accept: "application/json",
        Referer: "https://www.dcard.tw/f",
      },
    });

    const payload = response.data;
    if (!Array.isArray(payload)) {
      throw new Error("Dcard API returned a non-array payload (possible Cloudflare challenge).");
    }

    const posts: ScrapedPost[] = [];
    for (const item of payload) {
      const externalId = toExternalId(item.id);
      const title = cleanText(item.title);
      if (!externalId || !title) {
        continue;
      }

      const reactionCount = Array.isArray(item.reactions)
        ? item.reactions.reduce((sum, reaction) => sum + toNumber(reaction.count), 0)
        : 0;

      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(item.excerpt).slice(0, 200) || undefined,
        url: toUrl(item, externalId),
        likeCount: toNumber(item.likeCount) || reactionCount,
        commentCount: toNumber(item.commentCount),
        postedAt: item.createdAt,
      });
    }

    return posts;
  }
}

