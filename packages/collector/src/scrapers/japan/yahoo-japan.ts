import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const YAHOO_JAPAN_RSS_FEEDS = [
  "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  "https://news.yahoo.co.jp/rss/topics/domestic.xml",
  "https://news.yahoo.co.jp/rss/topics/world.xml",
  "https://news.yahoo.co.jp/rss/topics/business.xml",
  "https://news.yahoo.co.jp/rss/topics/entertainment.xml",
  "https://news.yahoo.co.jp/rss/topics/sports.xml",
  "https://news.yahoo.co.jp/rss/topics/it.xml",
  "https://news.yahoo.co.jp/rss/topics/science.xml",
] as const;

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pickupId = parsed.searchParams.get("pickup");
    if (pickupId && /^\d+$/u.test(pickupId)) {
      return pickupId;
    }

    const fromPath = parsed.pathname.split("/").filter(Boolean).pop();
    if (fromPath) {
      return fromPath.slice(0, 512);
    }

    return null;
  } catch {
    return null;
  }
}

function normalizePublishedAt(value: string): string | undefined {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

async function fetchFeed(url: string): Promise<ScrapedPost[]> {
  const response = await fetchWithRetry<string>(url, {
    responseType: "text",
    headers: {
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      Referer: "https://news.yahoo.co.jp/",
    },
  });

  const { load } = await import("cheerio");
  const $ = load(response.data, { xmlMode: true });
  const posts: ScrapedPost[] = [];

  $("item").each((_, element) => {
    if (posts.length >= 20) {
      return false;
    }

    const item = $(element);
    const title = cleanText(item.find("title").first().text());
    const link = cleanText(item.find("link").first().text());
    if (!title || !link) {
      return;
    }

    const externalId = toExternalId(link) ?? link.slice(0, 512);
    posts.push({
      externalId,
      title,
      bodyPreview: cleanText(item.find("comments").first().text()).slice(0, 200) || undefined,
      url: link,
      postedAt: normalizePublishedAt(cleanText(item.find("pubDate").first().text())),
    });
  });

  return posts;
}

export class YahooJapanScraper extends BaseScraper {
  sourceId = "yahoo_japan";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const results = await Promise.all(
      YAHOO_JAPAN_RSS_FEEDS.map(async (feedUrl) => {
        try {
          return await fetchFeed(feedUrl);
        } catch {
          return [] as ScrapedPost[];
        }
      }),
    );

    const merged: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    for (const posts of results) {
      for (const post of posts) {
        if (seenIds.has(post.externalId)) {
          continue;
        }
        seenIds.add(post.externalId);
        merged.push(post);
        if (merged.length >= 50) {
          return merged;
        }
      }
    }

    if (merged.length === 0) {
      throw new Error("Yahoo Japan RSS returned no items across all configured feeds.");
    }

    return merged;
  }
}

