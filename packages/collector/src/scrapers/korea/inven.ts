import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const INVEN_NEWS_URL = "https://www.inven.co.kr/webzine/news/?site=webzine";
const INVEN_BASE_URL = "https://www.inven.co.kr";

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const newsId = parsed.searchParams.get("news");
    if (newsId && /^\d+$/u.test(newsId)) {
      return newsId;
    }
    return null;
  } catch {
    return null;
  }
}

function parseCommentCount(title: string): number {
  const matched = title.match(/\[(\d{1,5})\]/u);
  if (!matched) {
    return 0;
  }
  const numeric = Number.parseInt(matched[1] ?? "0", 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeTitle(title: string): string {
  return cleanText(title.replace(/\[\d{1,5}\]/gu, " ").trim());
}

function parsePostedAt(raw: string): string | undefined {
  const matched = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/u);
  if (!matched) {
    return undefined;
  }
  return `${matched[1]}-${matched[2]}-${matched[3]}T${matched[4]}:${matched[5]}:00+09:00`;
}

export class InvenScraper extends BaseScraper {
  sourceId = "inven";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(INVEN_NEWS_URL, {
      responseType: "text",
      headers: {
        Referer: "https://www.inven.co.kr/",
      },
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    $('a[href*="/webzine/news/?news="]').each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const anchor = $(element);
      const href = cleanText(anchor.attr("href"));
      if (!href) {
        return;
      }

      const url = new URL(href, INVEN_BASE_URL).toString();
      const externalId = toExternalId(url);
      if (!externalId || seenIds.has(externalId)) {
        return;
      }

      const rawTitle =
        cleanText(anchor.find("span.cols.title").first().text()) ||
        cleanText(anchor.attr("title")) ||
        cleanText(anchor.text());
      const title = normalizeTitle(rawTitle);
      if (!title) {
        return;
      }

      const container = anchor.closest("tr, li, div");
      seenIds.add(externalId);
      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(anchor.find("span.cols.summary").first().text()).slice(0, 200) || undefined,
        url,
        commentCount: parseCommentCount(rawTitle),
        postedAt: parsePostedAt(cleanText(container.find(".info").first().text())),
      });
    });

    return posts;
  }
}
