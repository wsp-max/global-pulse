import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText } from "../../utils/text-cleaner";

const CLIEN_URL = "https://www.clien.net/service/board/park";
const CLIEN_BASE = "https://www.clien.net";

function parseCount(value: string): number {
  const numeric = value.replace(/[^\d-]/g, "").trim();
  if (!numeric || numeric === "-") {
    return 0;
  }
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseExternalId(url: string): string | null {
  const matched = url.match(/\/(\d+)(?:\?|$)/);
  return matched?.[1] ?? null;
}

function parseClienPostedAt(timestamp: string): string | undefined {
  const normalized = timestamp.trim();
  if (!normalized) {
    return undefined;
  }

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

export class ClienScraper extends BaseScraper {
  sourceId = "clien";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(CLIEN_URL, {
      headers: {
        Referer: "https://www.clien.net/",
      },
      responseType: "text",
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);

    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    $(".list_item.symph_row").each((_, element) => {
      if (posts.length >= resolveCollectorSourceCap(this.sourceId, 50)) {
        return false;
      }

      const row = $(element);
      const title = cleanText(row.find(".subject_fixed").first().text());
      const href = row.find("a.list_subject").first().attr("href");

      if (!title || !href) {
        return;
      }

      const postUrl = new URL(href, CLIEN_BASE).toString();
      const externalId = parseExternalId(postUrl);

      if (!externalId || seenIds.has(externalId)) {
        return;
      }

      seenIds.add(externalId);

      posts.push({
        externalId,
        title,
        url: postUrl,
        author: cleanText(row.find(".list_author .nickname span").first().text()),
        viewCount: parseCount(cleanText(row.find(".list_hit .hit").first().text())),
        likeCount: parseCount(cleanText(row.find(".list_symph span").first().text())),
        commentCount: parseCount(cleanText(row.find(".list_reply span").first().text())),
        postedAt: parseClienPostedAt(cleanText(row.find(".list_time .timestamp").first().text())),
      });
    });

    return posts;
  }
}



