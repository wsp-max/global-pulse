import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
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

function toUtcHourBucket(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${year}${month}${day}${hour}`;
}

function toExternalId(item: WeiboHotTopic, capturedAt: Date, index: number): string {
  const seed = cleanText(item.word_scheme || item.word || item.note);
  const bucket = toUtcHourBucket(capturedAt);
  const rank = toNumber(item.realpos ?? item.rank ?? index + 1);

  if (!seed) {
    return `rank-${bucket}-${rank || "unknown"}`;
  }

  const safeSeed = encodeURIComponent(seed).slice(0, 160);
  return `${safeSeed}:${bucket}:r${rank || index + 1}`;
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

    const capturedAt = new Date();
    const postedAt = capturedAt.toISOString();
    const posts: ScrapedPost[] = [];
    for (const [index, item] of realtime.slice(0, resolveCollectorSourceCap(this.sourceId, 50)).entries()) {
      const title = cleanText(item.word || item.note);
      if (!title) {
        continue;
      }

      posts.push({
        externalId: toExternalId(item, capturedAt, index),
        title,
        bodyPreview: cleanText(item.note).slice(0, 200) || undefined,
        url: toSearchUrl(item),
        viewCount: toNumber(item.num),
        postedAt,
      });
    }

    return posts;
  }
}



