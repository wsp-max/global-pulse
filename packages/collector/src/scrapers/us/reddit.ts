import axios from "axios";
import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const REDDIT_BASE_URL = "https://www.reddit.com";
const REDDIT_OAUTH_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_OAUTH_API_BASE = "https://oauth.reddit.com";
const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT ??
  "global-pulse/1.0 (by /u/global_pulse_monitor; https://github.com/wsp-max/global-pulse)";

const REDDIT_SOURCE_TARGET_MAP = {
  reddit: { path: "r/all/hot", limit: 50 },
  reddit_worldnews: { path: "r/worldnews/hot", limit: 30 },
  reddit_japan: { path: "r/japan/hot", limit: 30 },
  reddit_japan_politics: { path: "r/japanpolitics/hot", limit: 30 },
  reddit_japan_tech: { path: "r/japantech/hot", limit: 30 },
  reddit_kpop: { path: "r/kpop/hot", limit: 30 },
  reddit_taiwan: { path: "r/taiwan/hot", limit: 30 },
  reddit_hongkong: { path: "r/hongkong/hot", limit: 30 },
  reddit_taiwan_tech: { path: "r/technology/hot", limit: 30 },
  reddit_china: { path: "r/china/hot", limit: 30 },
  reddit_korea: { path: "r/korea/hot", limit: 30 },
  reddit_korea_opentalk: { path: "r/korean/hot", limit: 30 },
  reddit_europe: { path: "r/europe/hot", limit: 30 },
  reddit_eu_union: { path: "r/europeanunion/hot", limit: 30 },
  reddit_askuk: { path: "r/askuk/hot", limit: 30 },
  reddit_greek: { path: "r/greece/hot", limit: 30 },
  reddit_germany: { path: "r/germany/hot", limit: 30 },
  reddit_france: { path: "r/france/hot", limit: 30 },
  reddit_unitedkingdom: { path: "r/unitedkingdom/hot", limit: 30 },
  reddit_spain: { path: "r/spain/hot", limit: 30 },
  reddit_italy: { path: "r/italy/hot", limit: 30 },
  reddit_science: { path: "r/science/hot", limit: 30 },
  reddit_mideast: { path: "r/arabs/hot", limit: 30 },
  reddit_mideast_arabic: { path: "r/arabic/hot", limit: 30 },
  reddit_pakistan: { path: "r/pakistan/hot", limit: 30 },
  reddit_israel: { path: "r/israel/hot", limit: 30 },
  reddit_iran: { path: "r/iran/hot", limit: 30 },
  reddit_turkey: { path: "r/turkey/hot", limit: 30 },
  reddit_middleeast: { path: "r/middleeast/hot", limit: 30 },
  reddit_russia: { path: "r/russia/hot", limit: 30 },
  reddit_russian: { path: "r/russian/hot", limit: 30 },
  reddit_ukraine: { path: "r/ukraine/hot", limit: 30 },
  reddit_belarus: { path: "r/belarus/hot", limit: 30 },
  reddit_brasil: { path: "r/brasil/hot", limit: 30 },
  reddit_brazil: { path: "r/brazil/hot", limit: 30 },
  reddit_brasilivre: { path: "r/brasilivre/hot", limit: 30 },
  reddit_india: { path: "r/india/hot", limit: 30 },
  reddit_indianews: { path: "r/indianews/hot", limit: 30 },
  reddit_indiaspeaks: { path: "r/indiaspeaks/hot", limit: 30 },
  reddit_developersindia: { path: "r/developersindia/hot", limit: 30 },
  reddit_indonesia: { path: "r/indonesia/hot", limit: 30 },
  reddit_jakarta: { path: "r/jakarta/hot", limit: 30 },
  reddit_bali: { path: "r/bali/hot", limit: 30 },
  reddit_mexico: { path: "r/mexico/hot", limit: 30 },
  reddit_mexicocity: { path: "r/mexicocity/hot", limit: 30 },
  reddit_australia: { path: "r/australia/hot", limit: 30 },
  reddit_sydney: { path: "r/sydney/hot", limit: 30 },
  reddit_vietnam: { path: "r/vietnam/hot", limit: 30 },
  reddit_vietnamese: { path: "r/vietnamese/hot", limit: 30 },
  reddit_thailand: { path: "r/thailand/hot", limit: 30 },
  reddit_bangkok: { path: "r/bangkok/hot", limit: 30 },
  reddit_argentina: { path: "r/argentina/hot", limit: 30 },
  reddit_buenosaires: { path: "r/buenosaires/hot", limit: 30 },
  reddit_canada: { path: "r/canada/hot", limit: 30 },
  reddit_ontario: { path: "r/ontario/hot", limit: 30 },
  reddit_nigeria: { path: "r/nigeria/hot", limit: 30 },
  reddit_lagos: { path: "r/lagos/hot", limit: 30 },
  reddit_southafrica: { path: "r/southafrica/hot", limit: 30 },
  reddit_johannesburg: { path: "r/johannesburg/hot", limit: 30 },
  reddit_politics: { path: "r/politics/hot", limit: 30 },
  reddit_news: { path: "r/news/hot", limit: 30 },
  reddit_japanese: { path: "r/japanese/hot", limit: 30 },
  reddit_taiwanese: { path: "r/taiwanese/hot", limit: 30 },
} as const;

type RedditSourceId = keyof typeof REDDIT_SOURCE_TARGET_MAP;

interface RedditPostData {
  id?: string;
  title?: string;
  selftext?: string;
  permalink?: string;
  author?: string;
  score?: number;
  num_comments?: number;
  created_utc?: number;
  url?: string;
}

interface RedditListingResponse {
  data?: {
    children?: Array<{
      data?: RedditPostData;
    }>;
  };
}

interface RedditTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toPostedAt(createdUtc: unknown): string | undefined {
  const seconds = toNumber(createdUtc);
  if (!seconds) {
    return undefined;
  }
  return new Date(seconds * 1000).toISOString();
}

function toAbsoluteRedditUrl(permalink: string | undefined): string | undefined {
  if (!permalink) {
    return undefined;
  }

  try {
    return new URL(permalink, REDDIT_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function oauthCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

function buildPublicListingUrls(path: string, limit: number): string[] {
  const encodedPath = path.startsWith("/") ? path.slice(1) : path;
  const query = `raw_json=1&limit=${limit}`;
  return [
    `https://www.reddit.com/${encodedPath}.json?${query}`,
    `https://old.reddit.com/${encodedPath}.json?${query}`,
    `https://www.reddit.com/${encodedPath}/.json?${query}`,
  ];
}

function toDisplayUrl(data: RedditPostData): string | undefined {
  const normalized = cleanText(data.url);
  if (normalized && /^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return toAbsoluteRedditUrl(data.permalink);
}

async function getOauthAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAtMs > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }

  const credentials = oauthCredentials();
  if (!credentials) {
    throw new Error("Reddit OAuth credentials are missing.");
  }

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const response = await axios.post<RedditTokenResponse>(REDDIT_OAUTH_TOKEN_URL, body.toString(), {
    auth: {
      username: credentials.clientId,
      password: credentials.clientSecret,
    },
    timeout: 10_000,
    headers: {
      "User-Agent": REDDIT_USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
  });

  const token = response.data?.access_token?.trim();
  if (!token) {
    throw new Error("Reddit OAuth token response missing access_token.");
  }

  const expiresInSec = Math.max(60, toNumber(response.data?.expires_in) || 3600);
  cachedAccessToken = {
    token,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  };

  return token;
}

async function fetchOAuthListing(path: string, limit: number): Promise<RedditListingResponse> {
  const token = await getOauthAccessToken();
  const url = `${REDDIT_OAUTH_API_BASE}/${path}?raw_json=1&limit=${limit}`;
  const response = await fetchWithRetry<RedditListingResponse>(
    url,
    {
      responseType: "json",
      headers: {
        Accept: "application/json",
        "User-Agent": REDDIT_USER_AGENT,
        Authorization: `Bearer ${token}`,
      },
    },
    2,
  );

  return response.data;
}

async function fetchPublicListing(url: string): Promise<RedditListingResponse> {
  const response = await fetchWithRetry<RedditListingResponse>(
    url,
    {
      responseType: "json",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.reddit.com/",
        "User-Agent": REDDIT_USER_AGENT,
      },
      maxRedirects: 2,
      validateStatus: (status) => status >= 200 && status < 400,
    },
    2,
  );

  return response.data;
}

export class RedditScraper extends BaseScraper {
  sourceId: RedditSourceId;

  constructor(sourceId: RedditSourceId = "reddit") {
    super();
    this.sourceId = sourceId;
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const { path, limit } = REDDIT_SOURCE_TARGET_MAP[this.sourceId];
    const errors: string[] = [];
    let payload: RedditListingResponse | null = null;

    if (oauthCredentials()) {
      try {
        payload = await fetchOAuthListing(path, limit);
      } catch (error) {
        errors.push(
          `oauth: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!payload) {
      for (const url of buildPublicListingUrls(path, limit)) {
        try {
          payload = await fetchPublicListing(url);
          break;
        } catch (error) {
          errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    if (!payload) {
      throw new Error(
        `Reddit listing fetch failed for ${this.sourceId}. ${errors.join(" | ")}`.slice(0, 1500),
      );
    }

    const children = payload.data?.children ?? [];
    const posts: ScrapedPost[] = [];

    for (const item of children) {
      const data = item.data;
      if (!data?.id || !data.title) {
        continue;
      }

      const title = cleanText(data.title);
      if (!title) {
        continue;
      }

      posts.push({
        externalId: data.id,
        title,
        bodyPreview: cleanText(data.selftext).slice(0, 200) || undefined,
        url: toDisplayUrl(data),
        author: cleanText(data.author),
        likeCount: toNumber(data.score),
        commentCount: toNumber(data.num_comments),
        postedAt: toPostedAt(data.created_utc),
      });

      if (posts.length >= limit) {
        break;
      }
    }

    return posts;
  }
}
