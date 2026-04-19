import { createHash } from "node:crypto";
import { SOURCES, type ScrapedPost, type Source } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import {
  extractNumericCount,
  normalizePublishedAt,
  sanitizeNewsBodyPreview,
  sanitizeNewsTitle,
  sanitizeNewsUrl,
} from "./feed-sanitizer";
import { NEWS_BOT_USER_AGENT, guardNewsRequest } from "./robots";

const RANKING_ITEM_SELECTORS = [
  ".ranking_list li",
  ".list_newsissue li",
  ".rankingnews_list li",
  ".news-rank li",
  ".newsRanking li",
  "ol li",
] as const;

function sourceById(sourceId: string): Source {
  const source = SOURCES.find((item) => item.id === sourceId);
  if (!source || source.type !== "news") {
    throw new Error(`news source not found: ${sourceId}`);
  }
  return source;
}

function stableHash(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

function parseRank(input: string, fallbackRank: number): number {
  const direct = extractNumericCount(input);
  if (!direct) {
    return fallbackRank;
  }
  return Math.max(1, Math.min(200, direct));
}

export class BaseRankingNewsScraper extends BaseScraper {
  readonly sourceId: string;
  readonly source: Source;

  constructor(sourceId: string) {
    super();
    this.sourceId = sourceId;
    this.source = sourceById(sourceId);
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    await guardNewsRequest(this.source.scrapeUrl, this.source.trustTier);

    const response = await fetchWithRetry<string>(this.source.scrapeUrl, {
      responseType: "text",
      headers: {
        "User-Agent": NEWS_BOT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      timeout: 20_000,
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);
    const posts: ScrapedPost[] = [];
    const seen = new Set<string>();

    const selectedNodes = (() => {
      for (const selector of RANKING_ITEM_SELECTORS) {
        const nodes = $(selector);
        if (nodes.length >= 5) {
          return nodes;
        }
      }
      return $("a");
    })();

    selectedNodes.each((index, element) => {
      if (posts.length >= 40) {
        return false;
      }

      const node = $(element);
      const anchor = node.is("a") ? node : node.find("a").first();
      const rawTitle = sanitizeNewsTitle(anchor.text() || node.text());
      if (!rawTitle || rawTitle.length < 4) {
        return;
      }

      const href = sanitizeNewsUrl(anchor.attr("href"));
      const externalId = stableHash(`${this.sourceId}:${href ?? rawTitle}:${index}`);
      if (seen.has(externalId)) {
        return;
      }
      seen.add(externalId);

      const rankText = node.find(".rank,.ranking_num,.num").first().text();
      const rank = parseRank(rankText, index + 1);
      const viewCountText = node.find(".count,.view,.hits,.num").last().text() || node.text();
      const viewCount = extractNumericCount(viewCountText);
      const publishedText =
        node.find("time").attr("datetime") ||
        node.find("time").text() ||
        node.find(".date,.time").first().text();

      posts.push({
        externalId,
        title: rawTitle,
        bodyPreview: sanitizeNewsBodyPreview(node.text(), 280),
        url: href,
        postedAt: normalizePublishedAt(publishedText),
        rank,
        viewCount,
      });
    });

    if (posts.length === 0) {
      throw new Error(`no ranking entries parsed from ${this.source.scrapeUrl}`);
    }

    return posts;
  }
}
