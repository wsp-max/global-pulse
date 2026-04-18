import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const SLASHDOT_RSS_URL = "https://rss.slashdot.org/Slashdot/slashdot";

function parseCount(value: string): number {
  const parsed = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const matched = parsed.pathname.match(/\/story\/\d+\/\d+\/\d+\/(\d+)/u);
    if (matched?.[1]) {
      return matched[1];
    }
    const fromPath = parsed.pathname.split("/").filter(Boolean).join("-");
    return fromPath ? fromPath.slice(0, 512) : null;
  } catch {
    return null;
  }
}

function normalizePublishedAt(dateText: string): string | undefined {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

export class SlashdotScraper extends BaseScraper {
  sourceId = "slashdot";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(SLASHDOT_RSS_URL, {
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

      const externalId = toExternalId(link) ?? link.slice(0, 512);
      if (seenIds.has(externalId)) {
        return;
      }

      seenIds.add(externalId);
      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(item.find("description").first().text()).slice(0, 200) || undefined,
        url: link,
        author: cleanText(item.find("dc\\:creator, creator").first().text()) || undefined,
        commentCount: parseCount(item.find("slash\\:comments, comments").first().text()),
        postedAt: normalizePublishedAt(
          cleanText(item.find("dc\\:date, pubDate, date").first().text()),
        ),
      });
    });

    return posts;
  }
}
