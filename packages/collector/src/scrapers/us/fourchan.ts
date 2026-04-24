import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { resolveCollectorSourceCap } from "../../utils/source-scaling";
import { cleanText } from "../../utils/text-cleaner";

const FOURCHAN_CATALOG_URL = "https://a.4cdn.org/pol/catalog.json";
const FOURCHAN_THREAD_URL = "https://boards.4chan.org/pol/thread";
const MAX_THREADS = resolveCollectorSourceCap("fourchan", 50);

interface FourchanThread {
  no?: number;
  sub?: string;
  com?: string;
  replies?: number;
  images?: number;
  time?: number;
}

interface FourchanCatalogPage {
  threads?: FourchanThread[];
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPostedAt(unixSeconds: unknown): string | undefined {
  const numeric = toNumber(unixSeconds);
  if (!numeric) {
    return undefined;
  }
  return new Date(numeric * 1000).toISOString();
}

function buildTitle(thread: FourchanThread): string {
  const subject = cleanText(thread.sub);
  if (subject) {
    return subject;
  }

  const comment = cleanText(thread.com);
  if (comment) {
    return comment.slice(0, 80);
  }

  return `Thread #${thread.no ?? "unknown"}`;
}

export class FourchanScraper extends BaseScraper {
  sourceId = "fourchan";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<FourchanCatalogPage[]>(FOURCHAN_CATALOG_URL, {
      responseType: "json",
      headers: {
        Accept: "application/json",
      },
    });

    const allThreads = (response.data ?? []).flatMap((page) => page.threads ?? []);
    const rankedThreads = allThreads
      .filter((thread) => typeof thread.no === "number")
      .sort((a, b) => {
        const aScore = toNumber(a.replies) + toNumber(a.images) * 0.3;
        const bScore = toNumber(b.replies) + toNumber(b.images) * 0.3;
        return bScore - aScore;
      })
      .slice(0, MAX_THREADS);

    return rankedThreads.map((thread) => {
      const threadId = String(thread.no);
      return {
        externalId: threadId,
        title: buildTitle(thread),
        bodyPreview: cleanText(thread.com).slice(0, 200) || undefined,
        url: `${FOURCHAN_THREAD_URL}/${threadId}`,
        commentCount: toNumber(thread.replies),
        viewCount: 0,
        likeCount: toNumber(thread.images),
        postedAt: toPostedAt(thread.time),
      } satisfies ScrapedPost;
    });
  }
}
