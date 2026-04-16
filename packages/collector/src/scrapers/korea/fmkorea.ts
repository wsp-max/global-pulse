import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { fetchGoogleNewsSiteFallback } from "../../utils/google-news-fallback";
import { cleanText } from "../../utils/text-cleaner";

const FMKOREA_URL = "https://www.fmkorea.com/index.php?mid=best";
const FMKOREA_BASE = "https://www.fmkorea.com";
const FMKOREA_GOOGLE_NEWS_RSS =
  "https://news.google.com/rss/search?q=site:fmkorea.com&hl=ko&gl=KR&ceid=KR:ko";

function parseCount(value: string): number {
  const numeric = value.replace(/[^\d-]/g, "").trim();
  if (!numeric || numeric === "-") {
    return 0;
  }
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("document_srl");
    if (fromQuery && /^\d+$/.test(fromQuery)) {
      return fromQuery;
    }

    const matched = parsed.pathname.match(/\/(\d{5,})$/);
    if (matched?.[1]) {
      return matched[1];
    }

    return null;
  } catch {
    return null;
  }
}

export class FmkoreaScraper extends BaseScraper {
  sourceId = "fmkorea";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const directErrors: string[] = [];
    try {
      const response = await fetchWithRetry<string>(FMKOREA_URL, {
        headers: {
          Referer: "https://www.fmkorea.com/",
        },
        responseType: "text",
      });

      const { load } = await import("cheerio");
      const $ = load(response.data);

      const posts: ScrapedPost[] = [];
      const seenIds = new Set<string>();

      const selectors = [".fm_best_widget li", ".li_best2_pop0"];

      for (const selector of selectors) {
        $(selector).each((_, element) => {
          if (posts.length >= 50) {
            return false;
          }

          const row = $(element);
          const link = row.find("h3.title a, a.hotdeal_var8").first();
          const href = link.attr("href");

          if (!href) {
            return;
          }

          if (!href.includes("document_srl=") && !href.includes("/best/")) {
            return;
          }

          const postUrl = new URL(href, FMKOREA_BASE).toString();
          const externalId = parseExternalId(postUrl);
          if (!externalId || seenIds.has(externalId)) {
            return;
          }

          const title =
            cleanText(row.find("h3.title .ellipsis-target").first().text()) ||
            cleanText(link.text().replace(/\[\d+\]/g, ""));
          if (!title) {
            return;
          }

          seenIds.add(externalId);

          posts.push({
            externalId,
            title,
            url: postUrl,
            author: cleanText(row.find(".author").first().text()).replace(/^\//, "").trim(),
            likeCount: parseCount(cleanText(row.find(".pc_voted_count .count").first().text())),
            commentCount: parseCount(cleanText(row.find(".comment_count").first().text())),
            postedAt: cleanText(row.find(".regdate").first().text()) || undefined,
          });
        });
      }

      if (posts.length > 0) {
        return posts;
      }
      directErrors.push("empty result from direct HTML parse");
    } catch (error) {
      directErrors.push(error instanceof Error ? error.message : String(error));
    }

    const fallbackPosts = await fetchGoogleNewsSiteFallback({
      rssUrl: FMKOREA_GOOGLE_NEWS_RSS,
      sourceHost: "fmkorea.com",
      maxItems: 30,
      maxAgeHours: 72,
      titleSuffixes: ["에펨코리아"],
    });
    if (fallbackPosts.length > 0) {
      return fallbackPosts;
    }

    throw new Error(`FMKorea fetch failed. ${directErrors.join(" | ")}`.slice(0, 1000));
  }
}

