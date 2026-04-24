import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText, cleanUrl } from "../../utils/text-cleaner";

const EXPAT_MIDEAST_URL = "https://www.expat.com/en/forum/middle-east/";
const EXPAT_BASE_URL = "https://www.expat.com";

function toExternalId(url: string): string {
  try {
    const parsed = new URL(url);
    const matched = parsed.pathname.match(/\/(\d+)-/u);
    if (matched?.[1]) {
      return matched[1].slice(0, 512);
    }
    return parsed.pathname.split("/").filter(Boolean).join("-").slice(0, 512);
  } catch {
    return url.slice(0, 512);
  }
}

function parseCount(text: string): number {
  const normalized = cleanText(text).toLowerCase();
  const matched = normalized.match(/(\d+(?:\.\d+)?)\s*([km])?\s*(?:reply|replies|view|views)/u);
  if (!matched?.[1]) {
    return 0;
  }

  const base = Number.parseFloat(matched[1]);
  if (!Number.isFinite(base)) {
    return 0;
  }

  const multiplier = matched[2] === "k" ? 1_000 : matched[2] === "m" ? 1_000_000 : 1;
  return Math.round(base * multiplier);
}

function parseAuthor(text: string): string | undefined {
  const matched = cleanText(text).match(/\bby\s+(.+)$/iu);
  return matched?.[1] ? cleanText(matched[1]) : undefined;
}

export class ExpatMideastScraper extends BaseScraper {
  sourceId = "expat_mideast";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(EXPAT_MIDEAST_URL, {
      responseType: "text",
      headers: {
        Referer: EXPAT_MIDEAST_URL,
      },
      timeout: 20_000,
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    $(".card-topic").each((_, element) => {
      if (posts.length >= resolveCollectorSourceCap(this.sourceId, 50)) {
        return false;
      }

      const row = $(element);
      const linkElement = row.find('.card-topic--details--title--link[href*="/en/forum/middle-east/"]').first();
      const href = cleanUrl(linkElement.attr("href"));
      if (!href) {
        return;
      }

      const url = new URL(href, EXPAT_BASE_URL).toString();
      const externalId = toExternalId(url);
      if (seenIds.has(externalId)) {
        return;
      }

      const title = cleanText(linkElement.text());
      if (!title) {
        return;
      }

      seenIds.add(externalId);
      const lastPostText = cleanText(row.find(".card-topic--details--last-post").first().text());
      const countNodes = row.find(".card-topic--replies-views p");
      const replyText = cleanText(countNodes.eq(0).text());
      const viewText = cleanText(countNodes.eq(1).text());

      posts.push({
        externalId,
        title,
        bodyPreview: lastPostText.slice(0, 200) || undefined,
        url,
        author: parseAuthor(lastPostText),
        commentCount: parseCount(replyText),
        viewCount: parseCount(viewText),
      });
    });

    if (posts.length === 0) {
      throw new Error(`no expat mideast topics parsed from ${EXPAT_MIDEAST_URL}`);
    }

    return posts;
  }
}


