import type { ScrapedPost } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";

export class TiebaScraper extends BaseScraper {
  sourceId = "tieba";

  async fetchAndParse(): Promise<ScrapedPost[]> {
    // Step 1 scaffold: parser implementation will be added per source in Step 2+.
    return [];
  }
}

