import { ClienScraper } from "../packages/collector/src/scrapers/korea/clien";
import { DcInsideScraper } from "../packages/collector/src/scrapers/korea/dcinside";
import { RedditEuropeScraper } from "../packages/collector/src/scrapers/europe/reddit-europe";
import { FmkoreaScraper } from "../packages/collector/src/scrapers/korea/fmkorea";
import { RedditMideastScraper } from "../packages/collector/src/scrapers/mideast/reddit-mideast";
import { YoutubeScraper } from "../packages/collector/src/scrapers/sns/youtube";
import { FourchanScraper } from "../packages/collector/src/scrapers/us/fourchan";
import { HackernewsScraper } from "../packages/collector/src/scrapers/us/hackernews";
import { RedditScraper } from "../packages/collector/src/scrapers/us/reddit";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("scripts:test-scraper");

function parseArg(flag: string): string | undefined {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function run(): Promise<void> {
  const sourceId = parseArg("--source");

  if (!sourceId) {
    logger.error({ usage: "npx tsx scripts/test-scraper.ts --source <sourceId>" }, "missing_source");
    process.exit(1);
  }

  const map = {
    dcinside: new DcInsideScraper(),
    fmkorea: new FmkoreaScraper(),
    clien: new ClienScraper(),
    reddit: new RedditScraper(),
    reddit_worldnews: new RedditScraper("reddit_worldnews"),
    reddit_europe: new RedditEuropeScraper(),
    reddit_mideast: new RedditMideastScraper(),
    fourchan: new FourchanScraper(),
    hackernews: new HackernewsScraper(),
    youtube_kr: new YoutubeScraper(),
    youtube_jp: new YoutubeScraper("youtube_jp"),
    youtube_us: new YoutubeScraper("youtube_us"),
  } as const;

  const scraper = map[sourceId as keyof typeof map];

  if (!scraper) {
    logger.error({ sourceId }, "unknown_source");
    process.exit(1);
  }

  const result = await scraper.scrape();
  logger.info(
    {
      sourceId,
      success: result.success,
      postCount: result.posts.length,
      scrapedAt: result.scrapedAt,
    },
    "scraper_test_completed",
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

run().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "scraper_test_failed",
  );
  process.exit(1);
});

