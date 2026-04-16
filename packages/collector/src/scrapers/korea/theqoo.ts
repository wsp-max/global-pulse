import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const THEQOO_URL = "https://theqoo.net/hot";
const THEQOO_BASE = "https://theqoo.net";

function toNumber(value: string): number {
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseDateFromTheqoo(value: string): string | undefined {
  const trimmed = cleanText(value);
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      return undefined;
    }
    const dt = new Date();
    dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  }

  if (/^\d{2}\.\d{2}\.\d{2}$/.test(trimmed)) {
    const [yy, mm, dd] = trimmed.split(".");
    const yy2 = Number(yy);
    const year = yy2 > 80 ? 1900 + yy2 : 2000 + yy2;
    return new Date(`${year}-${mm}-${dd}T00:00:00`).toISOString();
  }

  return undefined;
}

function parseExternalId(href: string): string {
  const direct = cleanText(href);
  if (direct) {
    const matched = direct.match(/\/hot\/(\d+)/);
    if (matched?.[1]) {
      return matched[1];
    }
  }

  return "";
}

export class TheqooScraper extends BaseScraper {
  sourceId = "theqoo";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(THEQOO_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: "https://theqoo.net",
      },
      responseType: "text",
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);

    const posts: ScrapedPost[] = [];
    const seen = new Set<string>();

    $("table tbody tr").each((_, element) => {
      if (posts.length >= 50) {
        return false;
      }

      const row = $(element);
      const rowClass = cleanText(row.attr("class"));
      if (/\bnotice\b/i.test(rowClass)) {
        return;
      }

      const titleLink = row.find("td.title a[href^='/hot/']").first();
      const title = cleanText(titleLink.text());
      if (!title) {
        return;
      }

      const externalId = parseExternalId(
        titleLink.attr("href") ?? "",
      );
      if (!externalId || seen.has(externalId)) {
        return;
      }
      seen.add(externalId);

      const href = titleLink.attr("href");
      if (!href) {
        return;
      }

      posts.push({
        externalId,
        title,
        url: new URL(href, THEQOO_BASE).toString(),
        author: cleanText(row.find("td.name").first().text()),
        likeCount: 0,
        dislikeCount: 0,
        commentCount: toNumber(row.find("a.replyNum").first().text()),
        viewCount: toNumber(row.find("td.m_no").first().text()),
        postedAt: parseDateFromTheqoo(row.find(".time").first().text()),
      });
    });

    return posts;
  }
}

