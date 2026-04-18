import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText, cleanUrl } from "../../utils/text-cleaner";

const MASTODON_TRENDS_URL = "https://mastodon.social/api/v1/trends/statuses?limit=30";
const MASTODON_SOURCE_IDS = ["mastodon", "mastodon_me", "mastodon_ru"] as const;
type MastodonSourceId = (typeof MASTODON_SOURCE_IDS)[number];

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

function filterByRegionScript(sourceId: MastodonSourceId, text: string): boolean {
  const normalized = text.toLowerCase();
  if (sourceId === "mastodon_me") {
    return (
      /[\u0600-\u06FF]/u.test(text) ||
      /(gaza|israel|iran|saudi|uae|dubai|qatar|lebanon|palestin|middle east|arab)/u.test(normalized)
    );
  }
  if (sourceId === "mastodon_ru") {
    return (
      /[\u0400-\u04FF]/u.test(text) ||
      /(russia|ukraine|moscow|kremlin|putin|россия|украин|москва)/u.test(normalized)
    );
  }
  return true;
}

export class MastodonScraper extends BaseScraper {
  sourceId: MastodonSourceId;

  constructor(sourceId: MastodonSourceId = "mastodon") {
    super();
    if (!MASTODON_SOURCE_IDS.includes(sourceId)) {
      throw new Error(`Unsupported Mastodon source: ${sourceId}`);
    }
    this.sourceId = sourceId;
  }

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
      if (!filterByRegionScript(this.sourceId, content)) {
        continue;
      }

      posts.push({
        externalId,
        title: content.slice(0, 120),
        bodyPreview: content.slice(0, 200) || undefined,
        url: cleanUrl(item.url || item.uri) || undefined,
        author: cleanText(item.account?.acct || item.account?.username) || undefined,
        likeCount: toNumber(item.favourites_count) + toNumber(item.reblogs_count),
        commentCount: toNumber(item.replies_count),
        postedAt: item.created_at,
      });
    }

    return posts;
  }
}

