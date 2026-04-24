import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText } from "../../utils/text-cleaner";

const DC_HIT_URL = "https://gall.dcinside.com/board/lists?id=hit&page=1";
const DC_BASE_URL = "https://gall.dcinside.com";

function parseCount(value: string): number {
  const numeric = value.replace(/[^\d-]/g, "").trim();
  if (!numeric || numeric === "-") {
    return 0;
  }
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePostedAt(value: string): string | undefined {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2})[./](\d{2})[./](\d{2})$/);

  if (!match) {
    return undefined;
  }

  const [, yy, mm, dd] = match;
  return `20${yy}-${mm}-${dd}T00:00:00+09:00`;
}

function parseExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const value = parsed.searchParams.get("no");
    return value && /^\d+$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class DcInsideScraper extends BaseScraper {
  sourceId = "dcinside";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    await sleep(1_000 + Math.floor(Math.random() * 2_000));

    const response = await fetchWithRetry<string>(DC_HIT_URL, {
      headers: {
        Referer: "https://www.google.com/",
      },
      responseType: "text",
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);

    const posts: ScrapedPost[] = [];

    $("tr.ub-content").each((_, element) => {
      if (posts.length >= resolveCollectorSourceCap(this.sourceId, 50)) {
        return false;
      }

      const row = $(element);
      const numText = cleanText(row.find("td.gall_num").text());
      if (!/^\d+$/.test(numText)) {
        return;
      }

      const titleAnchor = row
        .find("td.gall_tit a[href*='/board/view/']")
        .first();
      const title = cleanText(titleAnchor.text());
      const href = titleAnchor.attr("href");

      if (!title || !href) {
        return;
      }

      const postUrl = new URL(href, DC_BASE_URL).toString();
      const externalId = parseExternalId(postUrl);

      if (!externalId) {
        return;
      }

      const commentText = cleanText(
        row.find("td.gall_tit .reply_numbox .reply_num").first().text(),
      );

      posts.push({
        externalId,
        title,
        url: postUrl,
        viewCount: parseCount(cleanText(row.find("td.gall_count").text())),
        likeCount: parseCount(cleanText(row.find("td.gall_recommend").text())),
        commentCount: parseCount(commentText),
        postedAt: parsePostedAt(cleanText(row.find("td.gall_date").text())),
      });
    });

    return posts;
  }
}



