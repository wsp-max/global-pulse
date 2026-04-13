import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const MASTODON_TRENDS_URL = "https://mastodon.social/api/v1/trends/statuses?limit=30";

interface MastodonTrendStatus {
  id?: string;
  url?: string;
  uri?: string;
  created_at?: string;
  content?: string;
  favourites_count?: number;
  replies_count?: number;
  reblogs_count?: number;
  account?: {
    acct?: string;
    username?: string;
  };
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export class MastodonScraper extends BaseScraper {
  sourceId = "mastodon";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<MastodonTrendStatus[]>(MASTODON_TRENDS_URL, {
      responseType: "json",
      headers: {
        Accept: "application/json",
      },
    });

    const payload = response.data;
    if (!Array.isArray(payload)) {
      throw new Error("Mastodon trends API returned a non-array payload.");
    }

    const posts: ScrapedPost[] = [];
    for (const item of payload) {
      const externalId = cleanText(item.id);
      const content = cleanText(item.content);
      if (!externalId || !content) {
        continue;
      }

      posts.push({
        externalId,
        title: content.slice(0, 120),
        bodyPreview: content.slice(0, 200) || undefined,
        url: cleanText(item.url || item.uri) || undefined,
        author: cleanText(item.account?.acct || item.account?.username) || undefined,
        likeCount: toNumber(item.favourites_count) + toNumber(item.reblogs_count),
        commentCount: toNumber(item.replies_count),
        postedAt: item.created_at,
      });
    }

    return posts;
  }
}

