import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const WEIBO_HOT_SEARCH_URL = "https://weibo.com/ajax/side/hotSearch";
const WEIBO_SEARCH_BASE_URL = "https://s.weibo.com/weibo?q=";

interface WeiboHotTopic {
  word?: string;
  note?: string;
  word_scheme?: string;
  num?: number | string;
  realpos?: number;
  rank?: number;
}

interface WeiboHotSearchResponse {
  ok?: number;
  data?: {
    realtime?: WeiboHotTopic[];
  };
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toExternalId(item: WeiboHotTopic): string {
  const seed = cleanText(item.word_scheme || item.word || item.note);
  if (!seed) {
    return `rank-${item.realpos ?? item.rank ?? "unknown"}`;
  }
  return seed.slice(0, 256);
}

function toSearchUrl(item: WeiboHotTopic): string | undefined {
  const keyword = cleanText(item.word_scheme || item.word || item.note);
  if (!keyword) {
    return undefined;
  }
  return `${WEIBO_SEARCH_BASE_URL}${encodeURIComponent(keyword)}`;
}

export class WeiboScraper extends BaseScraper {
  sourceId = "weibo";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<WeiboHotSearchResponse>(WEIBO_HOT_SEARCH_URL, {
      responseType: "json",
      headers: {
        Accept: "application/json",
        Referer: "https://s.weibo.com/top/summary?cate=realtimehot",
      },
    });

    const payload = response.data;
    const realtime = payload?.data?.realtime;
    if (payload?.ok !== 1 || !Array.isArray(realtime)) {
      throw new Error(`Weibo hot search API failed: ok=${payload?.ok ?? "unknown"}`);
    }

    const posts: ScrapedPost[] = [];
    for (const item of realtime.slice(0, 50)) {
      const title = cleanText(item.word || item.note);
      if (!title) {
        continue;
      }

      posts.push({
        externalId: toExternalId(item),
        title,
        bodyPreview: cleanText(item.note).slice(0, 200) || undefined,
        url: toSearchUrl(item),
        viewCount: toNumber(item.num),
      });
    }

    return posts;
  }
}

