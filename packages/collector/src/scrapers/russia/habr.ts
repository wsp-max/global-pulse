import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const HABR_RSS_URL = "https://habr.com/ru/rss/news/";

function toExternalId(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index];
      if (segment && /^\d{4,}$/u.test(segment)) {
        return segment.slice(0, 512);
      }
    }
    return cleanText(segments.join("-") || url).slice(0, 512);
  } catch {
    return cleanText(url).slice(0, 512);
  }
}

function normalizePublishedAt(value: string): string | undefined {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

export class HabrScraper extends BaseScraper {
  sourceId = "habr";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(HABR_RSS_URL, {
      responseType: "text",
      headers: {
        Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      },
    });

    const { load } = await import("cheerio");
    const $ = load(response.data, { xmlMode: true });
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    $("item").each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const item = $(element);
      const title = cleanText(item.find("title").first().text());
      const link = cleanText(item.find("link").first().text());
      if (!title || !link) {
        return;
      }

      const externalId = toExternalId(link);
      if (!externalId || seenIds.has(externalId)) {
        return;
      }
      seenIds.add(externalId);

      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(item.find("description").first().text()).slice(0, 200) || undefined,
        url: link,
        author: cleanText(item.find("dc\\:creator, creator").first().text()) || undefined,
        postedAt: normalizePublishedAt(cleanText(item.find("pubDate").first().text())),
      });
    });

    return posts;
  }
}
