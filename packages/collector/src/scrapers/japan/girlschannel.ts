import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const GIRLSCHANNEL_NEW_URL = "https://girlschannel.net/new/";
const GIRLSCHANNEL_BASE_URL = "https://girlschannel.net";

function parseCount(value: string): number {
  const numeric = value.replace(/[^\d]/gu, "");
  if (!numeric) {
    return 0;
  }
  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const matched = parsed.pathname.match(/^\/topics\/(\d+)/u);
    if (!matched?.[1]) {
      return null;
    }
    return matched[1];
  } catch {
    return null;
  }
}

function toPostedAt(relativeText: string): string | undefined {
  const normalized = cleanText(relativeText);
  if (!normalized) {
    return undefined;
  }

  const now = Date.now();
  const second = normalized.match(/(\d+)\s*秒前/u);
  if (second) {
    return new Date(now - Number(second[1]) * 1_000).toISOString();
  }

  const minute = normalized.match(/(\d+)\s*分前/u);
  if (minute) {
    return new Date(now - Number(minute[1]) * 60_000).toISOString();
  }

  const hour = normalized.match(/(\d+)\s*時間前/u);
  if (hour) {
    return new Date(now - Number(hour[1]) * 60 * 60_000).toISOString();
  }

  const day = normalized.match(/(\d+)\s*日前/u);
  if (day) {
    return new Date(now - Number(day[1]) * 24 * 60 * 60_000).toISOString();
  }

  return undefined;
}

export class GirlschannelScraper extends BaseScraper {
  sourceId = "girlschannel";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(GIRLSCHANNEL_NEW_URL, {
      responseType: "text",
      headers: {
        Referer: GIRLSCHANNEL_BASE_URL,
      },
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    $("div.topic-list-wrap li").each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const row = $(element);
      const link = row.find('a[href^="/topics/"]').first();
      const href = cleanText(link.attr("href"));
      if (!href) {
        return;
      }

      const url = new URL(href, GIRLSCHANNEL_BASE_URL).toString();
      const externalId = toExternalId(url);
      if (!externalId || seenIds.has(externalId)) {
        return;
      }

      const title = cleanText(row.find("p.title").first().text()) || cleanText(link.text());
      if (!title) {
        return;
      }

      seenIds.add(externalId);
      posts.push({
        externalId,
        title,
        url,
        commentCount: parseCount(row.find("p.comment").first().text()),
        postedAt: toPostedAt(cleanText(row.find(".datetime").first().text())),
      });
    });

    return posts;
  }
}
