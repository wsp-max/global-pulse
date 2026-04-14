import type { ScrapedPost } from "@global-pulse/shared";
import { existsSync } from "node:fs";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const DCARD_POPULAR_ENDPOINTS = [
  "https://www.dcard.tw/service/api/v2/posts?popular=true&limit=30",
  "https://www.dcard.tw/_api/posts?popular=true&limit=30",
] as const;

interface DcardPost {
  id?: number | string;
  title?: string;
  excerpt?: string;
  forumAlias?: string;
  createdAt?: string;
  likeCount?: number;
  commentCount?: number;
  reactions?: Array<{ count?: number }>;
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toExternalId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toUrl(post: DcardPost, externalId: string): string {
  const forumAlias = cleanText(post.forumAlias);
  if (forumAlias) {
    return `https://www.dcard.tw/f/${forumAlias}/p/${externalId}`;
  }
  return `https://www.dcard.tw/f/p/${externalId}`;
}

async function fetchPopularPosts(endpoint: string): Promise<DcardPost[]> {
  const response = await fetchWithRetry<DcardPost[] | string>(
    endpoint,
    {
      responseType: "json",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        Origin: "https://www.dcard.tw",
        Referer: "https://www.dcard.tw/f",
      },
      maxRedirects: 2,
      validateStatus: (status) => status >= 200 && status < 400,
    },
    2,
  );

  if (!Array.isArray(response.data)) {
    throw new Error("Dcard payload is not an array (possible challenge/redirect).");
  }
  return response.data;
}

type BrowserFetchResult =
  | { ok: true; endpoint: string; data: DcardPost[] }
  | { ok: false; endpoint: string; status: number; bodySnippet: string };

interface BrowserLaunchOptions {
  executablePath?: string;
  args?: string[];
  headless?: boolean | "shell";
}

function shouldDisableBrowserFallback(): boolean {
  const value = process.env.DCARD_DISABLE_BROWSER_FALLBACK;
  if (!value) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function redactSnippet(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").slice(0, 200);
}

async function resolveBrowserLaunchOptions(): Promise<BrowserLaunchOptions> {
  try {
    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default;
    const executablePath = await chromium.executablePath();
    if (executablePath && existsSync(executablePath)) {
      return {
        executablePath,
        args: chromium.args,
        headless: true,
      };
    }
  } catch {
    // fallback to local paths below
  }

  const localCandidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  for (const candidate of localCandidates) {
    if (existsSync(candidate)) {
      return {
        executablePath: candidate,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: true,
      };
    }
  }

  return {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
}

async function fetchPopularPostsViaBrowser(endpoints: readonly string[]): Promise<DcardPost[]> {
  const puppeteerModule = await import("puppeteer-core");
  const puppeteer = puppeteerModule.default;
  const launchOptions = await resolveBrowserLaunchOptions();

  const browser = await puppeteer.launch({
    ...launchOptions,
    timeout: 30_000,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    await page.goto("https://www.dcard.tw/f", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    const result = (await page.evaluate(async (requestEndpoints: string[]) => {
      const responses: BrowserFetchResult[] = [];
      for (const endpoint of requestEndpoints) {
        try {
          const res = await fetch(endpoint, {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json, text/plain, */*",
            },
          });

          const text = await res.text();
          if (!res.ok) {
            responses.push({
              ok: false,
              endpoint,
              status: res.status,
              bodySnippet: text.slice(0, 200),
            });
            continue;
          }

          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              responses.push({
                ok: true,
                endpoint,
                data: parsed as DcardPost[],
              });
              continue;
            }

            responses.push({
              ok: false,
              endpoint,
              status: res.status,
              bodySnippet: "non-array payload",
            });
          } catch {
            responses.push({
              ok: false,
              endpoint,
              status: res.status,
              bodySnippet: "invalid json payload",
            });
          }
        } catch (error) {
          responses.push({
            ok: false,
            endpoint,
            status: 0,
            bodySnippet: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return responses;
    }, [...endpoints])) as BrowserFetchResult[];

    const winner = result.find(
      (item): item is Extract<BrowserFetchResult, { ok: true }> =>
        item.ok && item.data.length > 0,
    );

    if (winner) {
      return winner.data;
    }

    const details = result
      .map((item) => {
        if (item.ok) {
          return `${item.endpoint}: empty payload`;
        }
        return `${item.endpoint}: status=${item.status}, body=${redactSnippet(item.bodySnippet)}`;
      })
      .join(" | ");

    throw new Error(`Browser fallback failed. ${details}`.slice(0, 1200));
  } finally {
    await browser.close();
  }
}

export class DcardScraper extends BaseScraper {
  sourceId = "dcard";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    let payload: DcardPost[] | null = null;
    const errors: string[] = [];

    for (const endpoint of DCARD_POPULAR_ENDPOINTS) {
      try {
        payload = await fetchPopularPosts(endpoint);
        if (payload.length > 0) {
          break;
        }
      } catch (error) {
        errors.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!payload && !shouldDisableBrowserFallback()) {
      try {
        payload = await fetchPopularPostsViaBrowser(DCARD_POPULAR_ENDPOINTS);
      } catch (error) {
        errors.push(`browser_fallback: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!payload) {
      throw new Error(
        `Dcard fetch failed. ${errors.join(" | ")}`.slice(0, 1200),
      );
    }

    const posts: ScrapedPost[] = [];
    for (const item of payload) {
      const externalId = toExternalId(item.id);
      const title = cleanText(item.title);
      if (!externalId || !title) {
        continue;
      }

      const reactionCount = Array.isArray(item.reactions)
        ? item.reactions.reduce((sum, reaction) => sum + toNumber(reaction.count), 0)
        : 0;

      posts.push({
        externalId,
        title,
        bodyPreview: cleanText(item.excerpt).slice(0, 200) || undefined,
        url: toUrl(item, externalId),
        likeCount: Math.max(toNumber(item.likeCount), reactionCount),
        commentCount: toNumber(item.commentCount),
        postedAt: cleanText(item.createdAt) || undefined,
      });
    }

    return posts;
  }
}
