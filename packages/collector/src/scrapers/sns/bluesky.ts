import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText, cleanUrl } from "../../utils/text-cleaner";

const BLUESKY_API_BASE_URL = "https://bsky.social/xrpc";
const BLUESKY_CREATE_SESSION_URL = `${BLUESKY_API_BASE_URL}/com.atproto.server.createSession`;
const BLUESKY_AUTHOR_FEED_URL = `${BLUESKY_API_BASE_URL}/app.bsky.feed.getAuthorFeed`;
const BLUESKY_SOURCE_IDS = [
  "bluesky_kr",
  "bluesky_jp",
  "bluesky_tw",
  "bluesky_cn",
  "bluesky_us",
  "bluesky_eu",
  "bluesky_me",
  "bluesky_ru",
] as const;

const DEFAULT_BLUESKY_MAX_HANDLES = 36;
const DEFAULT_BLUESKY_POSTS_PER_HANDLE = 120;
const DEFAULT_BLUESKY_SOURCE_POST_CAP = 210;

export type BlueskySourceId = (typeof BLUESKY_SOURCE_IDS)[number];

const SOURCE_HANDLE_ENV_BY_ID: Readonly<Record<BlueskySourceId, string>> = {
  bluesky_kr: "BLUESKY_KR_HANDLES",
  bluesky_jp: "BLUESKY_JP_HANDLES",
  bluesky_tw: "BLUESKY_TW_HANDLES",
  bluesky_cn: "BLUESKY_CN_HANDLES",
  bluesky_us: "BLUESKY_US_HANDLES",
  bluesky_eu: "BLUESKY_EU_HANDLES",
  bluesky_me: "BLUESKY_ME_HANDLES",
  bluesky_ru: "BLUESKY_RU_HANDLES",
};

const DEFAULT_HANDLES_BY_SOURCE: Readonly<Record<BlueskySourceId, string[]>> = {
  bluesky_kr: [],
  bluesky_jp: [],
  bluesky_tw: [],
  bluesky_cn: [],
  bluesky_us: ["bsky.app"],
  bluesky_eu: ["bsky.app"],
  bluesky_me: [],
  bluesky_ru: [],
};

interface BlueskySessionResponse {
  accessJwt?: string;
}

interface BlueskyAuthorFeedResponse {
  feed?: BlueskyFeedItem[];
}

interface BlueskyFeedItem {
  post?: {
    uri?: string;
    cid?: string;
    indexedAt?: string;
    replyCount?: number;
    repostCount?: number;
    likeCount?: number;
    quoteCount?: number;
    author?: {
      handle?: string;
    };
    record?: {
      text?: string;
      createdAt?: string;
    };
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPositiveInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return Math.min(max, parsed);
}

function toTimestamp(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDefaultReadySource(sourceId: BlueskySourceId): boolean {
  return sourceId === "bluesky_us" || sourceId === "bluesky_eu";
}

export function parseHandleList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^@+/, "").toLowerCase()),
    ),
  ];
}

export function resolveBlueskyMaxHandles(): number {
  return toPositiveInt(process.env.BLUESKY_MAX_HANDLES, DEFAULT_BLUESKY_MAX_HANDLES, 1, 60);
}

export function resolveBlueskyPostsPerHandle(): number {
  return toPositiveInt(process.env.BLUESKY_POSTS_PER_HANDLE, DEFAULT_BLUESKY_POSTS_PER_HANDLE, 1, 300);
}

export function resolveBlueskySourcePostCap(): number {
  return toPositiveInt(process.env.BLUESKY_SOURCE_POST_CAP, DEFAULT_BLUESKY_SOURCE_POST_CAP, 1, 600);
}

export function resolveConfiguredHandles(sourceId: BlueskySourceId): string[] {
  const maxHandles = resolveBlueskyMaxHandles();
  const fromSource = parseHandleList(process.env[SOURCE_HANDLE_ENV_BY_ID[sourceId]]);
  if (fromSource.length > 0) {
    return fromSource.slice(0, maxHandles);
  }

  if (isDefaultReadySource(sourceId)) {
    const fromDefault = parseHandleList(process.env.BLUESKY_DEFAULT_HANDLES);
    if (fromDefault.length > 0) {
      return fromDefault.slice(0, maxHandles);
    }

    return DEFAULT_HANDLES_BY_SOURCE[sourceId].slice(0, maxHandles);
  }

  return [];
}

function scorePost(post: ScrapedPost): number {
  return toNumber(post.likeCount) + toNumber(post.commentCount) * 1.5;
}

function rankPosts(posts: ScrapedPost[]): ScrapedPost[] {
  return [...posts].sort((left, right) => {
    const scoreDiff = scorePost(right) - scorePost(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return toTimestamp(right.postedAt) - toTimestamp(left.postedAt);
  });
}

export function rankAndCapPosts(posts: ScrapedPost[], cap: number): ScrapedPost[] {
  return rankPosts(posts).slice(0, Math.max(1, cap));
}

function postUriToRkey(uri: string | undefined): string {
  if (!uri) {
    return "";
  }
  const parts = uri.split("/");
  return cleanText(parts[parts.length - 1]);
}

async function createSessionToken(): Promise<string> {
  const identifier = cleanText(process.env.BLUESKY_IDENTIFIER);
  const appPassword = cleanText(process.env.BLUESKY_APP_PASSWORD);
  if (!identifier || !appPassword) {
    throw new Error("BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD are required.");
  }

  const response = await fetchWithRetry<BlueskySessionResponse>(BLUESKY_CREATE_SESSION_URL, {
    method: "POST",
    responseType: "json",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    data: {
      identifier,
      password: appPassword,
    },
  });

  const accessToken = cleanText(response.data?.accessJwt);
  if (!accessToken) {
    throw new Error("Bluesky session response missing access token.");
  }

  return accessToken;
}

async function fetchAuthorFeed(
  handle: string,
  accessToken: string,
  postsPerHandle: number,
): Promise<BlueskyFeedItem[]> {
  const query = new URLSearchParams({
    actor: handle,
    limit: String(postsPerHandle),
    filter: "posts_no_replies",
    includePins: "false",
  });

  const response = await fetchWithRetry<BlueskyAuthorFeedResponse>(
    `${BLUESKY_AUTHOR_FEED_URL}?${query.toString()}`,
    {
      responseType: "json",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!Array.isArray(response.data?.feed)) {
    return [];
  }

  return response.data.feed;
}

function toScrapedPost(item: BlueskyFeedItem, fallbackHandle: string): ScrapedPost | null {
  const post = item.post;
  if (!post) {
    return null;
  }

  const text = cleanText(post.record?.text);
  if (!text) {
    return null;
  }

  const authorHandle = cleanText(post.author?.handle || fallbackHandle).replace(/^@+/, "");
  const externalId = cleanText(post.cid || post.uri);
  const rkey = postUriToRkey(post.uri);

  if (!externalId || !authorHandle) {
    return null;
  }

  const postUrl =
    rkey.length > 0
      ? cleanUrl(`https://bsky.app/profile/${authorHandle}/post/${rkey}`) || undefined
      : undefined;

  return {
    externalId,
    title: text.slice(0, 120),
    bodyPreview: text.slice(0, 200) || undefined,
    url: postUrl,
    author: authorHandle,
    likeCount: toNumber(post.likeCount) + toNumber(post.repostCount) + toNumber(post.quoteCount),
    commentCount: toNumber(post.replyCount),
    postedAt: post.record?.createdAt || post.indexedAt,
  };
}

export class BlueskyScraper extends BaseScraper {
  sourceId: BlueskySourceId;

  constructor(sourceId: BlueskySourceId = "bluesky_us") {
    super();
    if (!BLUESKY_SOURCE_IDS.includes(sourceId)) {
      throw new Error(`Unsupported Bluesky source: ${sourceId}`);
    }
    this.sourceId = sourceId;
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const accessToken = await createSessionToken();
    const handles = resolveConfiguredHandles(this.sourceId);
    if (handles.length === 0) {
      throw new Error(`No Bluesky handles configured for ${this.sourceId}.`);
    }

    const postsPerHandle = resolveBlueskyPostsPerHandle();
    const sourcePostCap = resolveBlueskySourcePostCap();
    const postsById = new Map<string, ScrapedPost>();
    const errors: string[] = [];

    for (const handle of handles) {
      try {
        const feedItems = await fetchAuthorFeed(handle, accessToken, postsPerHandle);
        for (const item of feedItems) {
          const mapped = toScrapedPost(item, handle);
          if (!mapped) {
            continue;
          }

          const existing = postsById.get(mapped.externalId);
          if (!existing || scorePost(mapped) > scorePost(existing)) {
            postsById.set(mapped.externalId, mapped);
          }
        }
      } catch (error) {
        errors.push(`${handle}:${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const posts = rankAndCapPosts([...postsById.values()], sourcePostCap);
    if (posts.length === 0 && errors.length > 0) {
      throw new Error(`Bluesky API returned no posts (${errors.slice(0, 3).join("; ")})`);
    }

    return posts;
  }
}

export const __blueskyTestUtils = {
  parseHandleList,
  rankAndCapPosts,
  resolveConfiguredHandles,
  resolveBlueskyMaxHandles,
  resolveBlueskyPostsPerHandle,
  resolveBlueskySourcePostCap,
};
