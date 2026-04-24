import { createHash } from "node:crypto";
import { SOURCES, type ScrapedPost, type Source } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText, cleanUrl } from "../../utils/text-cleaner";

function sourceById(sourceId: string): Source {
  const source = SOURCES.find((item) => item.id === sourceId);
  if (!source || (source.type !== "community" && source.type !== "sns")) {
    throw new Error(`community source not found: ${sourceId}`);
  }
  return source;
}

function toExternalId(item: { guid?: string; link?: string; title?: string }, fallbackSeed: string): string {
  const guid = cleanText(item.guid);
  if (guid) {
    return guid.slice(0, 512);
  }

  const link = cleanUrl(item.link);
  if (link) {
    return link.slice(0, 512);
  }

  return createHash("sha256").update(fallbackSeed).digest("hex").slice(0, 32);
}

function normalizePublishedAt(value: string): string | undefined {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function parseCount(value: string): number {
  const normalized = cleanText(value);
  if (!normalized || /^https?:\/\//iu.test(normalized) || normalized.includes("/")) {
    return 0;
  }

  const matched = normalized.match(/^\D*(\d{1,7})\D*$/u);
  if (!matched?.[1]) {
    return 0;
  }

  const parsed = Number.parseInt(matched[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class RssCommunityScraper extends BaseScraper {
  readonly sourceId: string;
  readonly source: Source;

  constructor(sourceId: string) {
    super();
    this.sourceId = sourceId;
    this.source = sourceById(sourceId);
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(this.source.scrapeUrl, {
      responseType: "text",
      headers: {
        Accept: "*/*",
      },
      timeout: 30_000,
    });

    const { load } = await import("cheerio");
    const $ = load(response.data, { xmlMode: true });
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();
    const itemNodes = $("item").length > 0 ? $("item") : $("entry");

    itemNodes.each((index, element) => {
      if (posts.length >= resolveCollectorSourceCap(this.sourceId, 50)) {
        return false;
      }

      const item = $(element);
      const title = cleanText(item.find("title").first().text());
      const link =
        cleanUrl(item.find("link").first().attr("href")) ||
        cleanUrl(item.find("link").first().text()) ||
        cleanUrl(item.find("id").first().text());
      if (!title || !link) {
        return;
      }

      const guid = cleanText(item.find("guid").first().text()) || cleanText(item.find("id").first().text());
      const externalId = toExternalId({ guid, link, title }, `${this.sourceId}-${index}-${title}`);
      if (seenIds.has(externalId)) {
        return;
      }
      seenIds.add(externalId);

      const description =
        cleanText(item.find("description").first().text()) ||
        cleanText(item.find("summary").first().text()) ||
        cleanText(item.find("content").first().text()) ||
        cleanText(item.find("content\\:encoded").first().text());
      const publishedText =
        cleanText(item.find("pubDate").first().text()) ||
        cleanText(item.find("published").first().text()) ||
        cleanText(item.find("updated").first().text()) ||
        cleanText(item.find("dc\\:date").first().text());

      posts.push({
        externalId,
        title,
        bodyPreview: description.slice(0, 200) || undefined,
        url: link,
        author: cleanText(item.find("dc\\:creator, creator, author").first().text()) || undefined,
        commentCount: parseCount(item.find("slash\\:comments, comments").first().text()),
        postedAt: normalizePublishedAt(publishedText),
      });
    });

    if (posts.length === 0) {
      throw new Error(`no rss items parsed from ${this.source.scrapeUrl}`);
    }

    return posts;
  }
}


