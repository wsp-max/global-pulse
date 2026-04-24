import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText } from "../../utils/text-cleaner";

const FARK_RSS_URLS = [
  "https://www.fark.com/rss/fark.rss",
  "https://news.google.com/rss/search?q=site:fark.com&hl=en-US&gl=US&ceid=US:en",
];

function parseCount(value: string): number {
  const numeric = value.replace(/[^\d]/gu, "");
  if (!numeric) {
    return 0;
  }
  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toExternalId(link: string, guid: string): string {
  if (guid) {
    return guid.slice(0, 512);
  }

  try {
    const parsed = new URL(link);
    const matched = parsed.pathname.match(/\/comments\/(\d+)/u);
    if (matched?.[1]) {
      return matched[1];
    }
    return parsed.pathname.split("/").filter(Boolean).join("-").slice(0, 512);
  } catch {
    return link.slice(0, 512);
  }
}

function normalizePublishedAt(dateText: string): string | undefined {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function normalizeTitle(rawTitle: string): { title: string; commentCountFromTitle: number } {
  const normalized = cleanText(rawTitle);
  const matched = normalized.match(/^(.*?)\s*\[(\d{1,6})\]$/u);
  if (!matched) {
    return { title: normalized, commentCountFromTitle: 0 };
  }

  const title = cleanText(matched[1]);
  const commentCount = parseCount(matched[2] ?? "0");
  return {
    title: title || normalized,
    commentCountFromTitle: commentCount,
  };
}

export class FarkScraper extends BaseScraper {
  sourceId = "fark";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    let feedXml: string | null = null;
    const errors: string[] = [];

    for (const url of FARK_RSS_URLS) {
      try {
        const response = await fetchWithRetry<string>(url, {
          responseType: "text",
          headers: {
            Accept: "application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.8",
          },
        });
        feedXml = response.data;
        break;
      } catch (error) {
        errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!feedXml) {
      throw new Error(`Fark feed fetch failed: ${errors.join(" | ")}`.slice(0, 1200));
    }

    const { load } = await import("cheerio");
    const $ = load(feedXml, { xmlMode: true });
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();
    const itemNodes = $("item").length > 0 ? $("item") : $("entry");

    itemNodes.each((_, element) => {
      if (posts.length >= resolveCollectorSourceCap(this.sourceId, 50)) {
        return false;
      }

      const item = $(element);
      const link =
        cleanText(item.find("link").first().attr("href")) ||
        cleanText(item.find("link").first().text());
      if (!link) {
        return;
      }

      const guid = cleanText(item.find("guid").first().text());
      const externalId = toExternalId(link, guid);
      if (seenIds.has(externalId)) {
        return;
      }

      const normalizedTitle = normalizeTitle(cleanText(item.find("title").first().text()));
      if (!normalizedTitle.title) {
        return;
      }

      seenIds.add(externalId);
      posts.push({
        externalId,
        title: normalizedTitle.title,
        bodyPreview:
          (cleanText(item.find("description").first().text()) ||
            cleanText(item.find("summary").first().text()) ||
            cleanText(item.find("content").first().text()))
            .slice(0, 200) || undefined,
        url: link,
        commentCount: normalizedTitle.commentCountFromTitle,
        postedAt: normalizePublishedAt(
          cleanText(item.find("pubDate").first().text()) || cleanText(item.find("updated").first().text()),
        ),
      });
    });

    return posts;
  }
}


