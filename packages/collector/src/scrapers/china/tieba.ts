import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText } from "../../utils/text-cleaner";

const TIEBA_HOT_TOPIC_LIST_URL = "https://tieba.baidu.com/hottopic/browse/topicList?res_type=1";
const TIEBA_BASE_URL = "https://tieba.baidu.com";

function parseCount(value: string): number {
  const normalized = cleanText(value).toLowerCase();
  const matched = normalized.match(/([\d.]+)\s*([wkm万亿]?)/u);
  if (!matched) {
    return 0;
  }

  const numeric = Number.parseFloat(matched[1] ?? "0");
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const unit = matched[2] ?? "";
  if (unit === "w" || unit === "万") {
    return Math.round(numeric * 10_000);
  }
  if (unit === "k") {
    return Math.round(numeric * 1_000);
  }
  if (unit === "m") {
    return Math.round(numeric * 1_000_000);
  }
  if (unit === "亿") {
    return Math.round(numeric * 100_000_000);
  }
  return Math.round(numeric);
}

function toExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const topicId = parsed.searchParams.get("topic_id");
    if (topicId && /^\d+$/.test(topicId)) {
      return topicId;
    }
    return null;
  } catch {
    return null;
  }
}

export class TiebaScraper extends BaseScraper {
  sourceId = "tieba";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<string>(TIEBA_HOT_TOPIC_LIST_URL, {
      responseType: "text",
      headers: {
        Referer: "https://tieba.baidu.com/",
      },
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);
    const posts: ScrapedPost[] = [];
    const seenIds = new Set<string>();

    $(".topic-top-item").each((_, element) => {
      if (posts.length >= resolveCollectorSourceCap(this.sourceId, 50)) {
        return false;
      }

      const row = $(element);
      const link = row.find("a.topic-text").first();
      const href = cleanText(link.attr("href"));
      const title = cleanText(link.text());
      if (!href || !title) {
        return;
      }

      const url = new URL(href, TIEBA_BASE_URL).toString();
      const externalId = toExternalId(url);
      if (!externalId || seenIds.has(externalId)) {
        return;
      }

      seenIds.add(externalId);
      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(row.find(".topic-top-item-desc").first().text()).slice(0, 200) || undefined,
        url,
        viewCount: parseCount(row.find(".topic-num").first().text()),
      });
    });

    return posts;
  }
}



