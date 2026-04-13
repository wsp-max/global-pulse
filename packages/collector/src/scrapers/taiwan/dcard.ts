import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const DCARD_POPULAR_ENDPOINTS = [
  "https://www.dcard.tw/service/api/v2/posts?popular=true&limit=30",
  "https://www.dcard.tw/_api/posts?popular=true&limit=30",
] as const;

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

async function fetchPopularPosts(endpoint: string): Promise<DcardPost[]> {
  const response = await fetchWithRetry<DcardPost[] | string>(
    endpoint,
    {
      responseType: "json",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        Origin: "https://www.dcard.tw",
        Referer: "https://www.dcard.tw/f",
      },
      maxRedirects: 2,
      validateStatus: (status) => status >= 200 && status < 400,
    },
    2,
  );

  if (!Array.isArray(response.data)) {
    throw new Error("Dcard payload is not an array (possible challenge/redirect).");
  }
  return response.data;
}

export class DcardScraper extends BaseScraper {
  sourceId = "dcard";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    let payload: DcardPost[] | null = null;
    const errors: string[] = [];

    for (const endpoint of DCARD_POPULAR_ENDPOINTS) {
      try {
        payload = await fetchPopularPosts(endpoint);
        if (payload.length > 0) {
          break;
        }
      } catch (error) {
        errors.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!payload) {
      throw new Error(
        `Dcard fetch failed. ${errors.join(" | ")}`.slice(0, 1200),
      );
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
        likeCount: Math.max(toNumber(item.likeCount), reactionCount),
        commentCount: toNumber(item.commentCount),
        postedAt: cleanText(item.createdAt) || undefined,
      });
    }

    return posts;
  }
}
