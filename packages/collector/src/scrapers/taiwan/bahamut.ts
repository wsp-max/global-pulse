import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { fetchGoogleNewsSiteFallback } from "../../utils/google-news-fallback";
import { cleanText } from "../../utils/text-cleaner";

const BAHAMUT_HOME_URL = "https://www.gamer.com.tw/";
const BAHAMUT_GNN_HOST = "gnn.gamer.com.tw";
const BAHAMUT_GOOGLE_NEWS_RSS =
  "https://news.google.com/rss/search?q=site:gamer.com.tw&hl=zh-TW&gl=TW&ceid=TW:zh-Hant";

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== BAHAMUT_GNN_HOST) {
      return null;
    }

    const sn = parsed.searchParams.get("sn");
    if (sn && /^\d+$/u.test(sn)) {
      return sn;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchDirectPosts(sourceId: string): Promise<ScrapedPost[]> {
  const response = await fetchWithRetry<string>(BAHAMUT_HOME_URL, {
    responseType: "text",
    headers: {
      Referer: BAHAMUT_HOME_URL,
    },
  });

  const { load } = await import("cheerio");
  const $ = load(response.data);
  const posts: ScrapedPost[] = [];
  const seenIds = new Set<string>();

  $('a[href*="gnn.gamer.com.tw/detail.php?sn="]').each((_, element) => {
    if (posts.length >= resolveCollectorSourceCap(sourceId, 50)) {
      return false;
    }

    const anchor = $(element);
    const href = cleanText(anchor.attr("href"));
    if (!href) {
      return;
    }

    const externalId = toExternalId(href);
    if (!externalId || seenIds.has(externalId)) {
      return;
    }

    const title = cleanText(anchor.text()) || cleanText(anchor.attr("title"));
    if (!title || title.length < 4) {
      return;
    }

    seenIds.add(externalId);
    posts.push({
      externalId,
      title,
      url: href,
    });
  });

  return posts;
}

export class BahamutScraper extends BaseScraper {
  sourceId = "bahamut";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const errors: string[] = [];
    try {
      const directPosts = await fetchDirectPosts(this.sourceId);
      if (directPosts.length > 0) {
        return directPosts;
      }
      errors.push("direct: empty result");
    } catch (error) {
      errors.push(`direct: ${error instanceof Error ? error.message : String(error)}`);
    }

    const fallbackPosts = await fetchGoogleNewsSiteFallback({
      rssUrl: BAHAMUT_GOOGLE_NEWS_RSS,
      sourceHost: "gamer.com.tw",
      maxItems: resolveCollectorSourceCap(this.sourceId, 30),
      maxAgeHours: 168,
      titleSuffixes: ["GNN", "Bahamut"],
    });
    if (fallbackPosts.length > 0) {
      return fallbackPosts;
    }

    throw new Error(`Bahamut fetch failed. ${errors.join(" | ")}`.slice(0, 1000));
  }
}


