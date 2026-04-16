import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const RULIWEB_URL = "https://bbs.ruliweb.com/best/selection";
const RULIWEB_BASE = "https://bbs.ruliweb.com";

function toNumber(value: string): number {
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseExternalId(href: string): string | null {
  const match = href.match(/\/(\d+)(?:\?.*)?$/);
  return match?.[1] ?? null;
}

export class RuliwebScraper extends BaseScraper {
  sourceId = "ruliweb";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(RULIWEB_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: "https://bbs.ruliweb.com",
      },
      responseType: "text",
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);

    const posts: ScrapedPost[] = [];
    const seen = new Set<string>();

    $("tr.table_body").each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const row = $(element);
      const title = cleanText(row.find(".subject a").first().text());
      const href = row.find(".subject a").first().attr("href");
      if (!title || !href) {
        return;
      }

      const externalId = parseExternalId(href);
      if (!externalId || seen.has(externalId)) {
        return;
      }
      seen.add(externalId);

      posts.push({
        externalId,
        title,
        url: new URL(href, RULIWEB_BASE).toString(),
        author: cleanText(row.find(".writer").first().text()),
        viewCount: toNumber(row.find("td.hit").first().text()),
        likeCount: toNumber(row.find("td.recomd").first().text()),
        commentCount: 0,
      });
    });

    return posts;
  }
}

