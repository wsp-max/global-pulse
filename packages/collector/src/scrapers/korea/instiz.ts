import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const INSTIZ_PT_URL = "https://www.instiz.net/pt";
const INSTIZ_BASE_URL = "https://www.instiz.net";

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const matched = parsed.pathname.match(/^\/pt\/(\d+)/u);
    if (!matched?.[1]) {
      return null;
    }
    return matched[1];
  } catch {
    return null;
  }
}

function parseCount(value: string): number {
  const numeric = value.replace(/[^\d]/gu, "");
  if (!numeric) {
    return 0;
  }
  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTitle(rawTitle: string): { title: string; commentCountFromTitle: number } {
  const normalized = cleanText(rawTitle);
  const matched = normalized.match(/^(.*?)(\d{1,5})$/u);
  if (!matched) {
    return { title: normalized, commentCountFromTitle: 0 };
  }

  const title = cleanText(matched[1]);
  if (title.length < 4) {
    return { title: normalized, commentCountFromTitle: 0 };
  }

  const numeric = Number.parseInt(matched[2] ?? "0", 10);
  if (!Number.isFinite(numeric)) {
    return { title, commentCountFromTitle: 0 };
  }

  return { title, commentCountFromTitle: numeric };
}

export class InstizScraper extends BaseScraper {
  sourceId = "instiz";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(INSTIZ_PT_URL, {
      responseType: "text",
      headers: {
        Referer: INSTIZ_BASE_URL,
      },
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    $('a[href*="/pt/"]').each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const anchor = $(element);
      const href = cleanText(anchor.attr("href"));
      if (!href) {
        return;
      }

      const url = new URL(href, INSTIZ_BASE_URL).toString();
      const externalId = toExternalId(url);
      if (!externalId || seenIds.has(externalId)) {
        return;
      }

      const row = anchor.closest("tr, li, div");
      const rawTitle =
        cleanText(anchor.text()) ||
        cleanText(row.find(".sbj, .texthead_notice").first().text()) ||
        cleanText(anchor.attr("title"));
      if (!rawTitle) {
        return;
      }

      const normalizedTitle = normalizeTitle(rawTitle);
      if (!normalizedTitle.title) {
        return;
      }

      const commentCountFromRow = parseCount(
        cleanText(row.find(".cmt2, .cmt3, .comment, .list_cmt").first().text()),
      );

      seenIds.add(externalId);
      posts.push({
        externalId,
        title: normalizedTitle.title,
        bodyPreview: cleanText(row.find(".memo, .summary").first().text()).slice(0, 200) || undefined,
        url,
        commentCount: Math.max(commentCountFromRow, normalizedTitle.commentCountFromTitle),
      });
    });

    return posts;
  }
}
