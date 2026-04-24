import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText } from "../../utils/text-cleaner";

const ZHIHU_HOT_API = "https://api.zhihu.com/topstory/hot-list";

interface ZhihuHotItemTarget {
  id?: number | string;
  title?: string;
  excerpt?: string;
  url?: string;
  created?: number | string;
  follower_count?: number | string;
  answer_count?: number | string;
  comment_count?: number | string;
}

interface ZhihuHotItem {
  id?: string;
  target?: ZhihuHotItemTarget;
}

interface ZhihuHotResponse {
  data?: ZhihuHotItem[];
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toExternalId(item: ZhihuHotItem, target: ZhihuHotItemTarget): string | null {
  if (typeof target.id === "string" && target.id.trim()) {
    return target.id;
  }
  if (typeof target.id === "number" && Number.isFinite(target.id)) {
    return String(target.id);
  }
  if (typeof item.id === "string" && item.id.trim()) {
    return item.id;
  }
  return null;
}

function toPostedAt(created: unknown): string | undefined {
  const timestamp = Number(created);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return undefined;
  }
  return new Date(timestamp * 1000).toISOString();
}

function toZhihuUrl(target: ZhihuHotItemTarget, externalId: string): string {
  const direct = cleanText(target.url);
  if (direct.startsWith("http://") || direct.startsWith("https://")) {
    return direct;
  }
  return `https://www.zhihu.com/question/${encodeURIComponent(externalId)}`;
}

export class ZhihuScraper extends BaseScraper {
  sourceId = "zhihu";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<ZhihuHotResponse>(ZHIHU_HOT_API, {
      responseType: "json",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://www.zhihu.com/hot",
      },
    });

    const list = response.data?.data;
    if (!Array.isArray(list)) {
      throw new Error("Zhihu hot list response is not an array.");
    }

    const posts: ScrapedPost[] = [];
    const seen = new Set<string>();

    for (const item of list.slice(0, resolveCollectorSourceCap(this.sourceId, 50))) {
      const target = item.target;
      if (!target) {
        continue;
      }

      const externalId = toExternalId(item, target);
      const title = cleanText(target.title);
      if (!externalId || !title || seen.has(externalId)) {
        continue;
      }

      seen.add(externalId);
      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(target.excerpt).slice(0, 200) || undefined,
        url: toZhihuUrl(target, externalId),
        viewCount: toNumber(target.follower_count),
        likeCount: toNumber(target.answer_count),
        commentCount: toNumber(target.comment_count),
        postedAt: toPostedAt(target.created),
      });
    }

    return posts;
  }
}



