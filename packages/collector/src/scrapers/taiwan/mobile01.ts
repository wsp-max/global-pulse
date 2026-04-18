import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { fetchGoogleNewsSiteFallback } from "../../utils/google-news-fallback";
import { cleanText } from "../../utils/text-cleaner";

const MOBILE01_TOPICLIST_URL = "https://www.mobile01.com/topiclist.php?f=638";
const MOBILE01_BASE_URL = "https://www.mobile01.com";
const MOBILE01_GOOGLE_NEWS_RSS =
  "https://news.google.com/rss/search?q=site:mobile01.com&hl=zh-TW&gl=TW&ceid=TW:zh-Hant";

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const topicId = parsed.searchParams.get("t");
    if (topicId && /^\d+$/u.test(topicId)) {
      return topicId;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchDirectPosts(): Promise<ScrapedPost[]> {
  const response = await fetchWithRetry<string>(MOBILE01_TOPICLIST_URL, {
    responseType: "text",
    headers: {
      Referer: MOBILE01_BASE_URL,
    },
  });

  const { load } = await import("cheerio");
  const $ = load(response.data);
  const posts: ScrapedPost[] = [];
  const seenIds = new Set<string>();

  $('a[href*="/topicdetail.php?f="]').each((_, element) => {
    if (posts.length >= 50) {
      return false;
    }

    const anchor = $(element);
    const href = cleanText(anchor.attr("href"));
    if (!href) {
      return;
    }

    const url = new URL(href, MOBILE01_BASE_URL).toString();
    const externalId = toExternalId(url);
    if (!externalId || seenIds.has(externalId)) {
      return;
    }

    const title = cleanText(anchor.text());
    if (!title || title.length < 4) {
      return;
    }

    seenIds.add(externalId);
    posts.push({
      externalId,
      title,
      url,
    });
  });

  return posts;
}

export class Mobile01Scraper extends BaseScraper {
  sourceId = "mobile01";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const errors: string[] = [];
    try {
      const directPosts = await fetchDirectPosts();
      if (directPosts.length > 0) {
        return directPosts;
      }
      errors.push("direct: empty result");
    } catch (error) {
      errors.push(`direct: ${error instanceof Error ? error.message : String(error)}`);
    }

    const fallbackPosts = await fetchGoogleNewsSiteFallback({
      rssUrl: MOBILE01_GOOGLE_NEWS_RSS,
      sourceHost: "mobile01.com",
      maxItems: 30,
      maxAgeHours: 168,
      titleSuffixes: ["Mobile01"],
    });
    if (fallbackPosts.length > 0) {
      return fallbackPosts;
    }

    throw new Error(`Mobile01 fetch failed. ${errors.join(" | ")}`.slice(0, 1000));
  }
}
