import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { fetchGoogleNewsSiteFallback } from "../../utils/google-news-fallback";
import { cleanText } from "../../utils/text-cleaner";

const ARCA_HOT_URL = "https://arca.live/hot";
const ARCA_BASE_URL = "https://arca.live";
const ARCA_GOOGLE_NEWS_RSS = [
  "https://news.google.com/rss/search?q=site:arca.live/b&hl=ko&gl=KR&ceid=KR:ko",
  "https://news.google.com/rss/search?q=site:arca.live&hl=ko&gl=KR&ceid=KR:ko",
] as const;

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const matched = parsed.pathname.match(/^\/b\/[^/]+\/(\d+)/u);
    if (matched?.[1]) {
      return matched[1];
    }
    return null;
  } catch {
    return null;
  }
}

function mergeByExternalId(postGroups: ScrapedPost[][], maxItems = Number.POSITIVE_INFINITY): ScrapedPost[] {
  const merged: ScrapedPost[] = [];
  const seenIds = new Set<string>();

  for (const posts of postGroups) {
    for (const post of posts) {
      if (seenIds.has(post.externalId)) {
        continue;
      }
      seenIds.add(post.externalId);
      merged.push(post);
      if (merged.length >= maxItems) {
        return merged;
      }
    }
  }

  return merged;
}

async function fetchDirectHotPosts(sourceId: string): Promise<ScrapedPost[]> {
  const response = await fetchWithRetry<string>(ARCA_HOT_URL, {
    responseType: "text",
    headers: {
      Referer: ARCA_BASE_URL,
    },
    validateStatus: (status) => status >= 200 && status < 500,
  });

  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status}`);
  }

  const { load } = await import("cheerio");
  const $ = load(response.data);
  const posts: ScrapedPost[] = [];
  const seenIds = new Set<string>();

  $('a[href*="/b/"]').each((_, element) => {
    if (posts.length >= resolveCollectorSourceCap(sourceId, 50)) {
      return false;
    }

    const anchor = $(element);
    const href = cleanText(anchor.attr("href"));
    if (!href) {
      return;
    }

    const url = new URL(href, ARCA_BASE_URL).toString();
    const externalId = toExternalId(url);
    if (!externalId || seenIds.has(externalId)) {
      return;
    }

    const title = cleanText(anchor.attr("title")) || cleanText(anchor.text());
    if (!title) {
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

async function fetchFallbackPosts(sourceId: string): Promise<ScrapedPost[]> {
  const groups: ScrapedPost[][] = [];
  for (const rssUrl of ARCA_GOOGLE_NEWS_RSS) {
    try {
      const posts = await fetchGoogleNewsSiteFallback({
        rssUrl,
        sourceHost: "arca.live",
        maxItems: resolveCollectorSourceCap(sourceId, 30),
        maxAgeHours: 168,
      });
      groups.push(posts);
    } catch {
      groups.push([]);
    }
  }

  return mergeByExternalId(groups, resolveCollectorSourceCap(sourceId, 50));
}

export class ArcaScraper extends BaseScraper {
  sourceId = "arca";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const errors: string[] = [];
    let directPosts: ScrapedPost[] = [];

    try {
      directPosts = await fetchDirectHotPosts(this.sourceId);
      if (directPosts.length >= 5) {
        return directPosts;
      }
    } catch (error) {
      errors.push(`direct: ${error instanceof Error ? error.message : String(error)}`);
    }

    const fallbackPosts = await fetchFallbackPosts(this.sourceId);
    const merged = mergeByExternalId([directPosts, fallbackPosts], resolveCollectorSourceCap(this.sourceId, 50));
    if (merged.length > 0) {
      return merged;
    }

    throw new Error(`Arca fetch failed. ${errors.join(" | ")}`.slice(0, 1000));
  }
}


