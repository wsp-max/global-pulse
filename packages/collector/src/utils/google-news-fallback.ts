import type { ScrapedPost } from "@global-pulse/shared";
import { fetchWithRetry } from "./http-client";
import { cleanText } from "./text-cleaner";

interface GoogleNewsFallbackOptions {
  rssUrl: string;
  sourceHost: string;
  maxItems?: number;
  maxAgeHours?: number;
  titleSuffixes?: string[];
}

function normalizeTitle(title: string, suffixes: string[]): string {
  let normalized = title;
  for (const suffix of suffixes) {
    const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`\\s*-\\s*${escaped}$`), "");
  }
  return cleanText(normalized);
}

function toISOStringIfRecent(pubDate: string, maxAgeHours: number): string | null {
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const ageMs = Date.now() - parsed.getTime();
  if (ageMs > maxAgeHours * 60 * 60 * 1000) {
    return null;
  }
  return parsed.toISOString();
}

export async function fetchGoogleNewsSiteFallback({
  rssUrl,
  sourceHost,
  maxItems = 30,
  maxAgeHours = 72,
  titleSuffixes = [],
}: GoogleNewsFallbackOptions): Promise<ScrapedPost[]> {
  const response = await fetchWithRetry<string>(rssUrl, {
    responseType: "text",
    headers: {
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      Referer: "https://news.google.com/",
    },
  });

  const { load } = await import("cheerio");
  const $ = load(response.data, { xmlMode: true });

  const posts: ScrapedPost[] = [];
  const seenExternalIds = new Set<string>();
  $("item").each((_, element) => {
    if (posts.length >= maxItems) {
      return false;
    }

    const item = $(element);
    const sourceUrl = cleanText(item.find("source").first().attr("url"));
    if (sourceHost && !sourceUrl.includes(sourceHost)) {
      return;
    }

    const rawTitle = cleanText(item.find("title").first().text());
    const title = normalizeTitle(rawTitle, titleSuffixes);
    const link = cleanText(item.find("link").first().text());
    const guid = cleanText(item.find("guid").first().text());
    const externalId = guid || link;
    if (!title || !link || !externalId || seenExternalIds.has(externalId)) {
      return;
    }

    const pubDateText = cleanText(item.find("pubDate").first().text());
    const postedAt = pubDateText ? toISOStringIfRecent(pubDateText, maxAgeHours) : null;
    if (pubDateText && !postedAt) {
      return;
    }

    seenExternalIds.add(externalId);
    posts.push({
      externalId: externalId.slice(0, 512),
      title,
      bodyPreview: cleanText(item.find("description").first().text()).slice(0, 200) || undefined,
      url: link,
      author: cleanText(item.find("source").first().text()) || undefined,
      postedAt: postedAt ?? undefined,
    });
  });

  return posts;
}
