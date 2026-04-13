import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const PTT_GOSSIPING_URL = "https://www.ptt.cc/bbs/Gossiping/index.html";
const PTT_BASE_URL = "https://www.ptt.cc";

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseExternalId(url: string): string | null {
  const matched = url.match(/\/([^/]+)\.html(?:\?|$)/);
  return matched?.[1] ?? null;
}

function parsePttDate(value: string): string | undefined {
  const matched = value.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!matched) {
    return undefined;
  }

  const month = toNumber(matched[1]);
  const day = toNumber(matched[2]);
  if (!month || !day) {
    return undefined;
  }

  const now = new Date();
  let year = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (month > currentMonth + 1) {
    year -= 1;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}T00:00:00+08:00`;
}

function parseRecommend(raw: string): { likeCount: number; dislikeCount: number } {
  const value = raw.trim().toUpperCase();
  if (!value) {
    return { likeCount: 0, dislikeCount: 0 };
  }

  if (value === "爆") {
    return { likeCount: 100, dislikeCount: 0 };
  }

  const downvote = value.match(/^X(\d+)$/);
  if (downvote) {
    return { likeCount: 0, dislikeCount: toNumber(downvote[1]) };
  }

  return { likeCount: toNumber(value), dislikeCount: 0 };
}

export class PttScraper extends BaseScraper {
  sourceId = "ptt";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(PTT_GOSSIPING_URL, {
      responseType: "text",
      headers: {
        Cookie: "over18=1",
        Referer: "https://www.ptt.cc/ask/over18",
      },
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);

    const posts: ScrapedPost[] = [];
    $(".r-ent").each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const row = $(element);
      const anchor = row.find(".title a").first();
      const title = cleanText(anchor.text());
      const href = anchor.attr("href");
      if (!title || !href) {
        return;
      }

      const url = new URL(href, PTT_BASE_URL).toString();
      const externalId = parseExternalId(url);
      if (!externalId) {
        return;
      }

      const recommend = parseRecommend(cleanText(row.find(".nrec").first().text()));
      posts.push({
        externalId,
        title,
        url,
        author: cleanText(row.find(".author").first().text()) || undefined,
        likeCount: recommend.likeCount,
        dislikeCount: recommend.dislikeCount,
        postedAt: parsePttDate(cleanText(row.find(".date").first().text())),
      });
    });

    return posts;
  }
}

