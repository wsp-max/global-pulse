import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const ITEM_URL = "https://hacker-news.firebaseio.com/v0/item";
const MAX_STORY_COUNT = 30;
const FETCH_CONCURRENCY = 10;

interface HackerNewsItem {
  id?: number;
  by?: string;
  title?: string;
  score?: number;
  descendants?: number;
  time?: number;
  url?: string;
  text?: string;
  type?: string;
  deleted?: boolean;
  dead?: boolean;
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toPostedAt(unixSeconds: unknown): string | undefined {
  const numeric = toNumber(unixSeconds);
  if (!numeric) {
    return undefined;
  }
  return new Date(numeric * 1000).toISOString();
}

function normalizeStoryUrl(id: number, url?: string): string {
  if (url && url.trim()) {
    return url;
  }
  return `https://news.ycombinator.com/item?id=${id}`;
}

async function fetchItem(id: number): Promise<HackerNewsItem | null> {
  try {
    const response = await fetchWithRetry<HackerNewsItem>(`${ITEM_URL}/${id}.json`, {
      responseType: "json",
      headers: {
        Accept: "application/json",
      },
    });
    return response.data ?? null;
  } catch {
    return null;
  }
}

export class HackernewsScraper extends BaseScraper {
  sourceId = "hackernews";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const idsResponse = await fetchWithRetry<number[]>(TOP_STORIES_URL, {
      responseType: "json",
      headers: {
        Accept: "application/json",
      },
    });

    const storyIds = (idsResponse.data ?? [])
      .filter((id) => Number.isFinite(id))
      .slice(0, MAX_STORY_COUNT);

    const posts: ScrapedPost[] = [];
    for (let start = 0; start < storyIds.length; start += FETCH_CONCURRENCY) {
      const batch = storyIds.slice(start, start + FETCH_CONCURRENCY);
      const items = await Promise.all(batch.map((id) => fetchItem(id)));

      for (const item of items) {
        if (!item?.id || item.type !== "story" || item.deleted || item.dead) {
          continue;
        }

        const title = cleanText(item.title);
        if (!title) {
          continue;
        }

        posts.push({
          externalId: String(item.id),
          title,
          bodyPreview: cleanText(item.text).slice(0, 200) || undefined,
          url: normalizeStoryUrl(item.id, item.url),
          author: item.by,
          likeCount: toNumber(item.score),
          commentCount: toNumber(item.descendants),
          postedAt: toPostedAt(item.time),
        });
      }
    }

    return posts;
  }
}
