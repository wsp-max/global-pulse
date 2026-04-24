import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText } from "../../utils/text-cleaner";

const PPOMPPU_URL = "https://www.ppomppu.co.kr/zboard/zboard.php?id=freeboard";
const PPOMPPU_BASE = "https://www.ppomppu.co.kr";

function toNumber(value: string): number {
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseExternalId(href: string): string | null {
  const match = href.match(/[?&]no=(\d+)/i);
  return match?.[1] ?? null;
}

export class PpomppuScraper extends BaseScraper {
  sourceId = "ppomppu";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(PPOMPPU_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: "https://www.ppomppu.co.kr/zboard/zboard.php?id=freeboard",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      responseType: "text",
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);

    const posts: ScrapedPost[] = [];
    const seen = new Set<string>();

    $("tr.baseList").each((_, element) => {
      if (posts.length >= resolveCollectorSourceCap(this.sourceId, 50)) {
        return false;
      }

      const row = $(element);
      const title = cleanText(row.find("a.baseList-title span").first().text());
      if (!title) {
        return;
      }

      const href = cleanText(row.find("a.baseList-title").first().attr("href"));
      const externalId = parseExternalId(href);
      if (!externalId || seen.has(externalId)) {
        return;
      }
      seen.add(externalId);

      posts.push({
        externalId,
        title,
        url: new URL(href, PPOMPPU_BASE).toString(),
        author: cleanText(row.find(".baseList-name").first().text()),
        viewCount: toNumber(row.find("td.baseList-views").first().text()),
        likeCount: 0,
        dislikeCount: 0,
        commentCount: toNumber(row.find("span.baseList-c").first().text()),
      });
    });

    return posts;
  }
}



