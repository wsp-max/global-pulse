import type { ScrapedPost, ScraperResult } from "@global-pulse/shared";

export interface Scraper {
  sourceId: string;
  scrape(): Promise<ScraperResult>;
}

export abstract class BaseScraper implements Scraper {
  abstract sourceId: string;

  abstract fetchAndParse(): Promise<ScrapedPost[]>;

  async scrape(): Promise<ScraperResult> {
    try {
      const posts = await this.fetchAndParse();
      return {
        sourceId: this.sourceId,
        posts,
        scrapedAt: new Date().toISOString(),
        success: true,
      };
    } catch (error) {
      return {
        sourceId: this.sourceId,
        posts: [],
        scrapedAt: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

