import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const HATENA_RSS_URL = "https://b.hatena.ne.jp/hotentry/all.rss";

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toExternalId(value: string): string {
  return value.trim().slice(0, 512);
}

export class HatenaScraper extends BaseScraper {
  sourceId = "hatena";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(HATENA_RSS_URL, {
      responseType: "text",
      headers: {
        Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      },
    });

    const { load } = await import("cheerio");
    const $ = load(response.data, { xmlMode: true });

    const posts: ScrapedPost[] = [];
    $("item").each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const item = $(element);
      const title = cleanText(item.find("title").first().text());
      const url = cleanText(item.find("link").first().text());
      if (!title || !url) {
        return;
      }

      const postedAt = cleanText(item.find("dc\\:date, date").first().text()) || undefined;
      const bookmarkCount = toNumber(
        cleanText(item.find("hatena\\:bookmarkcount, bookmarkcount").first().text()),
      );

      posts.push({
        externalId: toExternalId(url),
        title,
        bodyPreview: cleanText(item.find("description").first().text()).slice(0, 200) || undefined,
        url,
        likeCount: bookmarkCount,
        postedAt,
      });
    });

    return posts;
  }
}

