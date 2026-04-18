import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const TOGETTER_TOP_URL = "https://togetter.com/";
const TOGETTER_BASE_URL = "https://togetter.com";

function parseCount(value: string): number {
  const numeric = value.replace(/[^\d]/gu, "");
  if (!numeric) {
    return 0;
  }
  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const matched = parsed.pathname.match(/^\/li\/(\d+)/u);
    if (!matched?.[1]) {
      return null;
    }
    return matched[1];
  } catch {
    return null;
  }
}

export class TogetterScraper extends BaseScraper {
  sourceId = "togetter";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(TOGETTER_TOP_URL, {
      responseType: "text",
      headers: {
        Referer: TOGETTER_BASE_URL,
      },
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    $('a[href*="/li/"][title]').each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const anchor = $(element);
      const href = cleanText(anchor.attr("href"));
      if (!href) {
        return;
      }

      const url = new URL(href, TOGETTER_BASE_URL).toString();
      const externalId = toExternalId(url);
      if (!externalId || seenIds.has(externalId)) {
        return;
      }

      const title = cleanText(anchor.attr("title")) || cleanText(anchor.text());
      if (!title) {
        return;
      }

      const card = anchor.closest("div.inner").parent();
      seenIds.add(externalId);
      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(card.find(".description, .summary").first().text()).slice(0, 200) || undefined,
        url,
        viewCount: parseCount(card.find(".view_str span").first().text()),
        likeCount: parseCount(card.find(".count_favorite").first().text()),
        commentCount: parseCount(card.find(".count_twitter").first().text()),
      });
    });

    return posts;
  }
}
