import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const FIVECH_SUBBACK_URL = "https://itest.5ch.io/subbacks/bbynews.json";
const DEFAULT_SUBDOMAIN = "headline";

interface FivechSubbackResponse {
  total_count?: number;
  threads?: FivechThread[];
}

type FivechThread = [unknown, unknown, unknown, unknown, unknown, unknown, unknown?];

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseThreadToken(value: unknown): { board: string; dat: string } | null {
  const token = cleanText(String(value ?? ""));
  const matched = token.match(/^([A-Za-z0-9_]+)\/(\d{9,12})$/);
  if (!matched) {
    return null;
  }
  return { board: matched[1], dat: matched[2] };
}

function parsePostedAt(dat: string): string | undefined {
  const seconds = Number(dat);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  const minEpochSeconds = 946_684_800; // 2000-01-01T00:00:00Z
  const maxEpochSeconds = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;
  if (seconds < minEpochSeconds || seconds > maxEpochSeconds) {
    return undefined;
  }
  return new Date(seconds * 1000).toISOString();
}

function normalizeThreadActivity(value: unknown): number | undefined {
  const parsed = toNumber(value);
  // current subbacks payload often returns constant "2" that is not useful as engagement.
  if (parsed <= 2) {
    return undefined;
  }
  return parsed;
}

export class FivechScraper extends BaseScraper {
  sourceId = "fivech";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const response = await fetchWithRetry<FivechSubbackResponse>(FIVECH_SUBBACK_URL, {
      responseType: "json",
      headers: {
        Accept: "application/json",
      },
    });

    const payload = response.data;
    if (!payload || !Array.isArray(payload.threads)) {
      throw new Error("5ch subback API returned an invalid payload.");
    }

    const posts: ScrapedPost[] = [];
    for (const row of payload.threads.slice(0, 50)) {
      const title = cleanText(String(row[5] ?? ""));
      if (!title) {
        continue;
      }

      const token = parseThreadToken(row[3]);
      if (!token) {
        continue;
      }

      const postedAt = parsePostedAt(token.dat);
      // Skip non-time-based pinned/promotional rows (for example DAT tokens like 9247xxxxxx).
      if (!postedAt) {
        continue;
      }

      const subdomain = cleanText(String(row[2] ?? "")) || DEFAULT_SUBDOMAIN;
      const commentCount = normalizeThreadActivity(row[1]);
      posts.push({
        externalId: `${token.board}:${token.dat}`,
        title,
        bodyPreview: cleanText(String(row[4] ?? "")).slice(0, 200) || undefined,
        url: `https://itest.5ch.io/${subdomain}/test/read.cgi/${token.board}/${token.dat}`,
        commentCount,
        postedAt,
      });
    }

    return posts;
  }
}

