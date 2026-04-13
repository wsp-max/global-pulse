import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const REDDIT_BASE_URL = "https://www.reddit.com";
const REDDIT_ENDPOINT_MAP = {
  reddit: "https://www.reddit.com/r/all/hot.json?limit=50",
  reddit_worldnews: "https://www.reddit.com/r/worldnews/hot.json?limit=30",
  reddit_europe: "https://www.reddit.com/r/europe/hot.json?limit=30",
  reddit_mideast: "https://www.reddit.com/r/arabs/hot.json?limit=30",
} as const;

type RedditSourceId = keyof typeof REDDIT_ENDPOINT_MAP;

interface RedditListingResponse {
  data?: {
    children?: Array<{
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        permalink?: string;
        author?: string;
        score?: number;
        num_comments?: number;
        created_utc?: number;
      };
    }>;
  };
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toPostedAt(createdUtc: unknown): string | undefined {
  const seconds = toNumber(createdUtc);
  if (!seconds) {
    return undefined;
  }
  return new Date(seconds * 1000).toISOString();
}

function toRedditPostUrl(permalink: string | undefined): string | undefined {
  if (!permalink) {
    return undefined;
  }

  try {
    return new URL(permalink, REDDIT_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

export class RedditScraper extends BaseScraper {
  sourceId: RedditSourceId;

  constructor(sourceId: RedditSourceId = "reddit") {
    super();
    this.sourceId = sourceId;
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const endpoint = REDDIT_ENDPOINT_MAP[this.sourceId];
    const response = await fetchWithRetry<RedditListingResponse>(endpoint, {
      responseType: "json",
      headers: {
        Accept: "application/json",
      },
    });

    const children = response.data?.data?.children ?? [];
    const posts: ScrapedPost[] = [];

    for (const item of children) {
      const data = item.data;
      if (!data?.id || !data.title) {
        continue;
      }

      const title = cleanText(data.title);
      if (!title) {
        continue;
      }

      posts.push({
        externalId: data.id,
        title,
        bodyPreview: cleanText(data.selftext).slice(0, 200) || undefined,
        url: toRedditPostUrl(data.permalink),
        author: data.author,
        likeCount: toNumber(data.score),
        commentCount: toNumber(data.num_comments),
        postedAt: toPostedAt(data.created_utc),
      });

      if (posts.length >= 50) {
        break;
      }
    }

    return posts;
  }
}
