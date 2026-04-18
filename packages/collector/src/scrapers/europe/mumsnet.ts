import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const MUMSNET_FEED_URL = "https://www.mumsnet.com/talk/feed";

function normalizePublishedAt(value: string): string | undefined {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function toExternalId(link: string, guid: string): string {
  if (guid) {
    return guid.slice(0, 512);
  }

  try {
    const parsed = new URL(link);
    const fromPath = parsed.pathname.split("/").filter(Boolean).pop();
    if (fromPath) {
      return fromPath.slice(0, 512);
    }
    return link.slice(0, 512);
  } catch {
    return link.slice(0, 512);
  }
}

export class MumsnetScraper extends BaseScraper {
  sourceId = "mumsnet";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(MUMSNET_FEED_URL, {
      responseType: "text",
      headers: {
        Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
        Referer: "https://www.mumsnet.com/talk",
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

      const guid = cleanText(item.find("guid").first().text());
      const externalId = toExternalId(link, guid);
      if (seenIds.has(externalId)) {
        return;
      }

      seenIds.add(externalId);
      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(item.find("description").first().text()).slice(0, 200) || undefined,
        url: link,
        postedAt: normalizePublishedAt(cleanText(item.find("pubDate").first().text())),
      });
    });

    return posts;
  }
}
