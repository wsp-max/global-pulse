import { createHash } from "node:crypto";
import { SOURCES, type ScrapedPost, type Source } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import {
  normalizePublishedAt,
  sanitizeNewsBodyPreview,
  sanitizeNewsTitle,
  sanitizeNewsUrl,
} from "./feed-sanitizer";
import { NEWS_BOT_USER_AGENT, guardNewsRequest } from "./robots";

function sourceById(sourceId: string): Source {
  const source = SOURCES.find((item) => item.id === sourceId);
  if (!source || source.type !== "news") {
    throw new Error(`news source not found: ${sourceId}`);
  }
  return source;
}

function hashExternalId(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

function getExternalId(item: { guid?: string; link?: string; title?: string }, fallbackSeed: string): string {
  const guid = (item.guid ?? "").trim();
  if (guid) return guid.slice(0, 512);
  const link = (item.link ?? "").trim();
  if (link) return link.slice(0, 512);
  return hashExternalId(fallbackSeed);
}

export class BaseRssNewsScraper extends BaseScraper {
  readonly sourceId: string;
  readonly source: Source;

  constructor(sourceId: string) {
    super();
    this.sourceId = sourceId;
    this.source = sourceById(sourceId);
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    await guardNewsRequest(this.source.scrapeUrl, this.source.trustTier);

    const response = await fetchWithRetry<string>(this.source.scrapeUrl, {
      responseType: "text",
      headers: {
        "User-Agent": NEWS_BOT_USER_AGENT,
        Accept: "application/rss+xml,application/atom+xml,text/xml;q=0.9,application/xml;q=0.8,*/*;q=0.5",
      },
      timeout: 20_000,
    });

    const { load } = await import("cheerio");
    const $ = load(response.data, { xmlMode: true });
    const posts: ScrapedPost[] = [];
    const seen = new Set<string>();

    const itemNodes = $("item").length > 0 ? $("item") : $("entry");
    itemNodes.each((index, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const item = $(element);
      const rawTitle = item.find("title").first().text();
      const title = sanitizeNewsTitle(rawTitle);
      const linkFromTag =
        item.find("link").first().attr("href") ??
        item.find("link").first().text() ??
        item.find("id").first().text();
      const url = sanitizeNewsUrl(linkFromTag);
      if (!title) {
        return;
      }

      const guid = item.find("guid").first().text() || item.find("id").first().text();
      const externalId = getExternalId({ guid, link: url, title }, `${this.sourceId}-${index}-${title}`);
      if (seen.has(externalId)) {
        return;
      }
      seen.add(externalId);

      const description =
        item.find("description").first().text() ||
        item.find("summary").first().text() ||
        item.find("content").first().text();
      const publishedText =
        item.find("pubDate").first().text() ||
        item.find("published").first().text() ||
        item.find("updated").first().text();

      posts.push({
        externalId,
        title,
        bodyPreview: sanitizeNewsBodyPreview(description, 280),
        url,
        postedAt: normalizePublishedAt(publishedText),
      });
    });

    if (posts.length === 0) {
      throw new Error(`no rss items parsed from ${this.source.scrapeUrl}`);
    }

    return posts;
  }
}
