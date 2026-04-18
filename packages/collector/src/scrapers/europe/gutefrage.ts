import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const GUTEFRAGE_URL = "https://www.gutefrage.net/";
const GUTEFRAGE_BASE_URL = "https://www.gutefrage.net";

function parseAnswerCount(text: string): number {
  const matched = cleanText(text).match(/(\d+)\s+Antwort/u);
  if (!matched) {
    return 0;
  }

  const numeric = Number.parseInt(matched[1] ?? "0", 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const matched = parsed.pathname.match(/^\/(?:frage|umfrage)\/([^/?#]+)/u);
    if (!matched?.[1]) {
      return null;
    }
    return matched[1].slice(0, 512);
  } catch {
    return null;
  }
}

export class GutefrageScraper extends BaseScraper {
  sourceId = "gutefrage";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(GUTEFRAGE_URL, {
      responseType: "text",
      headers: {
        Referer: GUTEFRAGE_URL,
      },
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    $("article.Plate.ListingElement").each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const row = $(element);
      const link = row
        .find(
          'a.ListingElement-questionLink[href^="/frage/"], a.ListingElement-questionLink[href^="/umfrage/"]',
        )
        .first();
      const href = cleanText(link.attr("href"));
      if (!href) {
        return;
      }

      const url = new URL(href, GUTEFRAGE_BASE_URL).toString();
      const externalId = toExternalId(url);
      if (!externalId || seenIds.has(externalId)) {
        return;
      }

      const title =
        cleanText(row.find(".Question-title").first().text()) ||
        cleanText(link.attr("title")) ||
        cleanText(link.text());
      if (!title) {
        return;
      }

      seenIds.add(externalId);
      posts.push({
        externalId,
        title,
        bodyPreview:
          cleanText(row.find(".ListingElement-postPreview, .ListingElement-preview").first().text()).slice(
            0,
            200,
          ) || undefined,
        url,
        commentCount: parseAnswerCount(row.text()),
        postedAt: cleanText(row.find("gf-relative-time").first().attr("datetime")) || undefined,
      });
    });

    return posts;
  }
}

