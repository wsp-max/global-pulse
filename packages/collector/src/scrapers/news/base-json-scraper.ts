import { createHash } from "node:crypto";
import { SOURCES, type ScrapedPost, type Source } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import {
  normalizePublishedAt,
  sanitizeNewsBodyPreview,
  sanitizeNewsTitle,
  sanitizeNewsUrl,
} from "./feed-sanitizer";
import { NEWS_BOT_USER_AGENT, guardNewsRequest } from "./robots";

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

function collectObjects(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (depth > 4 || value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectObjects(item, depth + 1));
  }
  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const candidates: Array<Record<string, unknown>> = [];
  if (keys.includes("title") || keys.includes("headline")) {
    candidates.push(record);
  }

  for (const nested of Object.values(record)) {
    candidates.push(...collectObjects(nested, depth + 1));
  }

  return candidates;
}

export class BaseJsonNewsScraper extends BaseScraper {
  readonly sourceId: string;
  readonly source: Source;

  constructor(sourceId: string) {
    super();
    this.sourceId = sourceId;
    this.source = sourceById(sourceId);
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    await guardNewsRequest(this.source.scrapeUrl, this.source.trustTier);

    const response = await fetchWithRetry<unknown>(this.source.scrapeUrl, {
      responseType: "json",
      headers: {
        "User-Agent": NEWS_BOT_USER_AGENT,
        Accept: "application/json,*/*;q=0.8",
      },
      timeout: 20_000,
    });

    const objects = collectObjects(response.data);
    const posts: ScrapedPost[] = [];
    const seen = new Set<string>();

    for (const item of objects) {
      if (posts.length >= 50) {
        break;
      }

      const rawTitle = String(item.title ?? item.headline ?? "").trim();
      const title = sanitizeNewsTitle(rawTitle);
      if (!title) {
        continue;
      }

      const linkValue = item.url ?? item.link ?? item.permalink;
      const url = sanitizeNewsUrl(typeof linkValue === "string" ? linkValue : undefined);
      const externalId = String(item.id ?? item.guid ?? item.newsId ?? "")
        .trim()
        .slice(0, 512) || stableHash(`${this.sourceId}:${title}:${url ?? ""}`);

      if (seen.has(externalId)) {
        continue;
      }
      seen.add(externalId);

      const description = item.description ?? item.summary ?? item.excerpt ?? item.body;
      const publishedAt = item.publishedAt ?? item.pubDate ?? item.published ?? item.updatedAt;

      posts.push({
        externalId,
        title,
        bodyPreview: sanitizeNewsBodyPreview(typeof description === "string" ? description : "", 280),
        url,
        postedAt: normalizePublishedAt(typeof publishedAt === "string" ? publishedAt : undefined),
      });
    }

    if (posts.length === 0) {
      throw new Error(`no json items parsed from ${this.source.scrapeUrl}`);
    }

    return posts;
  }
}
