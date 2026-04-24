import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText, cleanUrl } from "../../utils/text-cleaner";

const MASTODON_SOURCE_IDS = [
  "mastodon_kr",
  "mastodon_jp",
  "mastodon_tw",
  "mastodon_cn",
  "mastodon_us",
  "mastodon_eu",
  "mastodon_me",
  "mastodon_ru",
] as const;

const DEFAULT_MASTODON_POSTS_PER_INSTANCE = 70;
const DEFAULT_MASTODON_SOURCE_POST_CAP = 70;
const DEFAULT_MASTODON_MAX_INSTANCES = 10;

export type MastodonSourceId = (typeof MASTODON_SOURCE_IDS)[number];

const SOURCE_INSTANCE_ENV_BY_ID: Readonly<Record<MastodonSourceId, string>> = {
  mastodon_kr: "MASTODON_KR_INSTANCES",
  mastodon_jp: "MASTODON_JP_INSTANCES",
  mastodon_tw: "MASTODON_TW_INSTANCES",
  mastodon_cn: "MASTODON_CN_INSTANCES",
  mastodon_us: "MASTODON_US_INSTANCES",
  mastodon_eu: "MASTODON_EU_INSTANCES",
  mastodon_me: "MASTODON_ME_INSTANCES",
  mastodon_ru: "MASTODON_RU_INSTANCES",
};

const DEFAULT_INSTANCES_BY_SOURCE: Readonly<Record<MastodonSourceId, string[]>> = {
  mastodon_kr: [],
  mastodon_jp: [],
  mastodon_tw: [],
  mastodon_cn: [],
  mastodon_us: ["https://mastodon.social"],
  mastodon_eu: ["https://mastodon.social", "https://mastodon.world"],
  mastodon_me: [],
  mastodon_ru: [],
};

interface MastodonStatus {
  id?: string;
  url?: string;
  uri?: string;
  created_at?: string;
  content?: string;
  favourites_count?: number;
  replies_count?: number;
  reblogs_count?: number;
  account?: {
    acct?: string;
    username?: string;
  };
}

interface MastodonFetchClient {
  fetchLocalTimeline: (
    instanceBaseUrl: string,
    headers: Readonly<Record<string, string>>,
    limit: number,
  ) => Promise<MastodonStatus[]>;
  fetchTrends: (
    instanceBaseUrl: string,
    headers: Readonly<Record<string, string>>,
    limit: number,
  ) => Promise<MastodonStatus[]>;
}

interface CollectFromInstancesOptions {
  sourceId: MastodonSourceId;
  instanceBaseUrls: string[];
  headers: Readonly<Record<string, string>>;
  postsPerInstance: number;
  sourcePostCap: number;
  fetchClient?: MastodonFetchClient;
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
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

function isDefaultReadySource(sourceId: MastodonSourceId): boolean {
  return sourceId === "mastodon_us" || sourceId === "mastodon_eu";
}

function normalizeInstanceBaseUrl(raw: string): string | null {
  const normalizedInput = raw.trim().toLowerCase();
  if (!normalizedInput) {
    return null;
  }

  const withProtocol = normalizedInput.includes("://") ? normalizedInput : `https://${normalizedInput}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function parseInstanceList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const normalized = value
    .split(",")
    .map((entry) => normalizeInstanceBaseUrl(entry))
    .filter((entry): entry is string => Boolean(entry));

  return [...new Set(normalized)];
}

export function resolveMastodonPostsPerInstance(): number {
  return toPositiveInt(
    process.env.MASTODON_POSTS_PER_INSTANCE,
    DEFAULT_MASTODON_POSTS_PER_INSTANCE,
    1,
    80,
  );
}

export function resolveMastodonSourcePostCap(): number {
  return toPositiveInt(process.env.MASTODON_SOURCE_POST_CAP, DEFAULT_MASTODON_SOURCE_POST_CAP, 1, 200);
}

function resolveMastodonMaxInstances(): number {
  return toPositiveInt(process.env.MASTODON_MAX_INSTANCES, DEFAULT_MASTODON_MAX_INSTANCES, 1, 15);
}

export function resolveConfiguredInstances(sourceId: MastodonSourceId): string[] {
  const maxInstances = resolveMastodonMaxInstances();
  const fromSource = parseInstanceList(process.env[SOURCE_INSTANCE_ENV_BY_ID[sourceId]]);
  if (fromSource.length > 0) {
    return fromSource.slice(0, maxInstances);
  }

  if (isDefaultReadySource(sourceId)) {
    return DEFAULT_INSTANCES_BY_SOURCE[sourceId].slice(0, maxInstances);
  }

  return [];
}

function scorePost(post: ScrapedPost): number {
  return toNumber(post.likeCount) + toNumber(post.commentCount) * 1.5;
}

function rankAndCapPosts(posts: ScrapedPost[], cap: number): ScrapedPost[] {
  return [...posts]
    .sort((left, right) => {
      const scoreDiff = scorePost(right) - scorePost(left);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return toTimestamp(right.postedAt) - toTimestamp(left.postedAt);
    })
    .slice(0, Math.max(1, cap));
}

function toScrapedPost(instanceBaseUrl: string, item: MastodonStatus): ScrapedPost | null {
  const rawId = cleanText(item.id);
  const content = cleanText(item.content);
  if (!rawId || !content) {
    return null;
  }

  const instanceHost = normalizeInstanceBaseUrl(instanceBaseUrl);
  if (!instanceHost) {
    return null;
  }

  return {
    externalId: `${instanceHost}:${rawId}`,
    title: content.slice(0, 120),
    bodyPreview: content.slice(0, 200) || undefined,
    url: cleanUrl(item.url || item.uri) || undefined,
    author: cleanText(item.account?.acct || item.account?.username) || undefined,
    likeCount: toNumber(item.favourites_count) + toNumber(item.reblogs_count),
    commentCount: toNumber(item.replies_count),
    postedAt: item.created_at,
  };
}

function resolveLocalTimelineUrl(instanceBaseUrl: string, limit: number): string {
  const query = new URLSearchParams({
    local: "true",
    limit: String(limit),
  });
  return `${instanceBaseUrl.replace(/\/+$/, "")}/api/v1/timelines/public?${query.toString()}`;
}

function resolveTrendsUrl(instanceBaseUrl: string, limit: number): string {
  const query = new URLSearchParams({
    limit: String(limit),
  });
  return `${instanceBaseUrl.replace(/\/+$/, "")}/api/v1/trends/statuses?${query.toString()}`;
}

const DEFAULT_FETCH_CLIENT: MastodonFetchClient = {
  async fetchLocalTimeline(instanceBaseUrl, headers, limit) {
    const response = await fetchWithRetry<MastodonStatus[]>(resolveLocalTimelineUrl(instanceBaseUrl, limit), {
      responseType: "json",
      headers,
    });

    if (!Array.isArray(response.data)) {
      throw new Error("local_timeline_non_array_payload");
    }
    return response.data;
  },
  async fetchTrends(instanceBaseUrl, headers, limit) {
    const response = await fetchWithRetry<MastodonStatus[]>(resolveTrendsUrl(instanceBaseUrl, limit), {
      responseType: "json",
      headers,
    });
    if (!Array.isArray(response.data)) {
      throw new Error("trends_non_array_payload");
    }
    return response.data;
  },
};

export async function collectFromInstances(options: CollectFromInstancesOptions): Promise<{
  posts: ScrapedPost[];
  errors: string[];
}> {
  const fetchClient = options.fetchClient ?? DEFAULT_FETCH_CLIENT;
  const postsById = new Map<string, ScrapedPost>();
  const errors: string[] = [];

  for (const instanceBaseUrl of options.instanceBaseUrls) {
    let statuses: MastodonStatus[] = [];
    let fetched = false;

    try {
      statuses = await fetchClient.fetchLocalTimeline(
        instanceBaseUrl,
        options.headers,
        options.postsPerInstance,
      );
      fetched = true;
    } catch (localError) {
      errors.push(
        `${instanceBaseUrl}:local:${
          localError instanceof Error ? localError.message : String(localError)
        }`,
      );
      try {
        statuses = await fetchClient.fetchTrends(
          instanceBaseUrl,
          options.headers,
          options.postsPerInstance,
        );
        fetched = true;
      } catch (trendsError) {
        errors.push(
          `${instanceBaseUrl}:trends:${
            trendsError instanceof Error ? trendsError.message : String(trendsError)
          }`,
        );
      }
    }

    if (!fetched) {
      continue;
    }

    for (const status of statuses) {
      const mapped = toScrapedPost(instanceBaseUrl, status);
      if (!mapped) {
        continue;
      }

      const existing = postsById.get(mapped.externalId);
      if (!existing || scorePost(mapped) > scorePost(existing)) {
        postsById.set(mapped.externalId, mapped);
      }
    }
  }

  return {
    posts: rankAndCapPosts([...postsById.values()], options.sourcePostCap),
    errors,
  };
}

function buildHeaders(): Record<string, string> {
  const accessToken = cleanText(process.env.MASTODON_ACCESS_TOKEN);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

export class MastodonScraper extends BaseScraper {
  sourceId: MastodonSourceId;

  constructor(sourceId: MastodonSourceId = "mastodon_eu") {
    super();
    if (!MASTODON_SOURCE_IDS.includes(sourceId)) {
      throw new Error(`Unsupported Mastodon source: ${sourceId}`);
    }
    this.sourceId = sourceId;
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const instanceBaseUrls = resolveConfiguredInstances(this.sourceId);
    if (instanceBaseUrls.length === 0) {
      throw new Error(`No Mastodon instances configured for ${this.sourceId}.`);
    }

    const postsPerInstance = resolveMastodonPostsPerInstance();
    const sourcePostCap = resolveMastodonSourcePostCap();
    const { posts, errors } = await collectFromInstances({
      sourceId: this.sourceId,
      instanceBaseUrls,
      headers: buildHeaders(),
      postsPerInstance,
      sourcePostCap,
    });

    if (posts.length === 0 && errors.length > 0) {
      throw new Error(`Mastodon APIs returned no posts (${errors.slice(0, 3).join("; ")})`);
    }

    return posts;
  }
}

export const __mastodonTestUtils = {
  parseInstanceList,
  resolveConfiguredInstances,
  resolveMastodonPostsPerInstance,
  resolveMastodonSourcePostCap,
  collectFromInstances,
};
