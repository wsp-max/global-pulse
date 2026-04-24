import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText } from "../../utils/text-cleaner";

const RESETERA_GAMING_RSS_URL = "https://www.resetera.com/forums/gaming-forum.7/index.rss";

function parseCount(value: string): number {
  const parsed = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toExternalId(url: string, guid: string): string {
  if (guid && /^\d+$/u.test(guid)) {
    return guid;
  }

  try {
    const parsed = new URL(url);
    const matched = parsed.pathname.match(/\.([0-9]+)\/?$/u);
    if (matched?.[1]) {
      return matched[1];
    }
    const fromPath = parsed.pathname.split("/").filter(Boolean).join("-");
    return fromPath.slice(0, 512);
  } catch {
    return (guid || url).slice(0, 512);
  }
}

function normalizePublishedAt(dateText: string): string | undefined {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function normalizeAuthor(value: string): string | undefined {
  const normalized = cleanText(value);
  if (!normalized) {
    return undefined;
  }

  const matched = normalized.match(/\(([^)]+)\)\s*$/u);
  if (matched?.[1]) {
    return cleanText(matched[1]) || undefined;
  }

  return normalized;
}

export class ReseteraScraper extends BaseScraper {
  sourceId = "resetera";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(RESETERA_GAMING_RSS_URL, {
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
      if (posts.length >= resolveCollectorSourceCap(this.sourceId, 50)) {
        return false;
      }

      const item = $(element);
      const title = cleanText(item.find("title").first().text());
      const link = cleanText(item.find("link").first().text());
      if (!title || !link) {
        return;
      }

      const externalId = toExternalId(link, cleanText(item.find("guid").first().text()));
      if (seenIds.has(externalId)) {
        return;
      }

      seenIds.add(externalId);
      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(item.find("content\\:encoded, description").first().text()).slice(0, 200) || undefined,
        url: link,
        author: normalizeAuthor(
          cleanText(item.find("dc\\:creator, author").first().text()),
        ),
        commentCount: parseCount(item.find("slash\\:comments, comments").first().text()),
        postedAt: normalizePublishedAt(cleanText(item.find("pubDate").first().text())),
      });
    });

    return posts;
  }
}


