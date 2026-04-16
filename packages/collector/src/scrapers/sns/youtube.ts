import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import { cleanText } from "../../utils/text-cleaner";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos";
const YOUTUBE_SOURCE_IDS = ["youtube_kr", "youtube_jp", "youtube_us"] as const;
type YoutubeSourceId = (typeof YOUTUBE_SOURCE_IDS)[number];

const YOUTUBE_REGION_CODE_OVERRIDES: Readonly<Record<YoutubeSourceId, string>> = {
  youtube_kr: "KR",
  youtube_jp: "JP",
  youtube_us: "US",
};

interface YoutubeTrendingResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      channelTitle?: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveRegionCode(sourceId: string): string {
  const match = sourceId.match(/^youtube_([a-z]{2})$/i);
  if (!match) {
    return "KR";
  }

  const sourceRegionCode = match[1]!.toLowerCase();
  return (
    YOUTUBE_REGION_CODE_OVERRIDES[sourceId as YoutubeSourceId] ??
    sourceRegionCode.toUpperCase()
  );
}

export class YoutubeScraper extends BaseScraper {
  sourceId: YoutubeSourceId;

  constructor(sourceId: YoutubeSourceId = "youtube_kr") {
    super();
    if (!YOUTUBE_SOURCE_IDS.includes(sourceId)) {
      throw new Error(`Unsupported YouTube source: ${sourceId}`);
    }
    this.sourceId = sourceId;
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error("YOUTUBE_API_KEY is missing.");
    }

    const regionCode = resolveRegionCode(this.sourceId);
    const query = new URLSearchParams({
      part: "snippet,statistics",
      chart: "mostPopular",
      regionCode,
      maxResults: "20",
      key: apiKey,
    });

    const response = await fetchWithRetry<YoutubeTrendingResponse>(
      `${YOUTUBE_API_URL}?${query.toString()}`,
      {
        responseType: "json",
        headers: {
          Accept: "application/json",
        },
      },
    );

    const posts: ScrapedPost[] = [];
    for (const item of response.data?.items ?? []) {
      const videoId = item.id;
      const title = cleanText(item.snippet?.title);
      if (!videoId || !title) {
        continue;
      }

      posts.push({
        externalId: videoId,
        title,
        bodyPreview: cleanText(item.snippet?.description).slice(0, 200) || undefined,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        author: cleanText(item.snippet?.channelTitle) || undefined,
        viewCount: toNumber(item.statistics?.viewCount),
        likeCount: toNumber(item.statistics?.likeCount),
        commentCount: toNumber(item.statistics?.commentCount),
        postedAt: item.snippet?.publishedAt,
      });
    }

    return posts;
  }
}
