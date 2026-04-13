import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const BILIBILI_HOTWORD_URL = "https://s.search.bilibili.com/main/hotword";

interface BilibiliHotwordResponse {
  code?: number;
  message?: string;
  list?: BilibiliHotword[];
}

interface BilibiliHotword {
  id?: number;
  hot_id?: number;
  keyword?: string;
  show_name?: string;
  heat_score?: number | string;
  goto_value?: string;
  stat_datas?: {
    stime?: string;
  };
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toPostedAt(stime: unknown): string | undefined {
  const seconds = toNumber(stime);
  if (!seconds) {
    return undefined;
  }
  return new Date(seconds * 1000).toISOString();
}

function toSearchUrl(keyword: string): string {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
}

export class BilibiliScraper extends BaseScraper {
  sourceId = "bilibili";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<BilibiliHotwordResponse>(BILIBILI_HOTWORD_URL, {
      responseType: "json",
      headers: {
        Accept: "application/json",
        Referer: "https://www.bilibili.com",
      },
    });

    const payload = response.data;
    if (!payload || payload.code !== 0 || !Array.isArray(payload.list)) {
      throw new Error(
        `Bilibili hotword API failed: code=${payload?.code ?? "unknown"}, message=${payload?.message ?? "unknown"}`,
      );
    }

    const posts: ScrapedPost[] = [];
    for (const item of payload.list.slice(0, 30)) {
      const keyword = cleanText(item.show_name || item.keyword);
      if (!keyword) {
        continue;
      }

      const externalId = String(item.hot_id ?? item.id ?? keyword);
      posts.push({
        externalId,
        title: keyword,
        bodyPreview: cleanText(item.keyword).slice(0, 200) || undefined,
        url: item.goto_value ? cleanText(item.goto_value) : toSearchUrl(keyword),
        viewCount: toNumber(item.heat_score),
        postedAt: toPostedAt(item.stat_datas?.stime),
      });
    }

    return posts;
  }
}

