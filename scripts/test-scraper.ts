import { ClienScraper } from "../packages/collector/src/scrapers/korea/clien";
import { DcInsideScraper } from "../packages/collector/src/scrapers/korea/dcinside";
import { RedditEuropeScraper } from "../packages/collector/src/scrapers/europe/reddit-europe";
import { FivechScraper } from "../packages/collector/src/scrapers/japan/fivech";
import { HatenaScraper } from "../packages/collector/src/scrapers/japan/hatena";
import { FmkoreaScraper } from "../packages/collector/src/scrapers/korea/fmkorea";
import { PpomppuScraper } from "../packages/collector/src/scrapers/korea/ppomppu";
import { RuliwebScraper } from "../packages/collector/src/scrapers/korea/ruliweb";
import { TheqooScraper } from "../packages/collector/src/scrapers/korea/theqoo";
import { RedditMideastScraper } from "../packages/collector/src/scrapers/mideast/reddit-mideast";
import { WeiboScraper } from "../packages/collector/src/scrapers/china/weibo";
import { ZhihuScraper } from "../packages/collector/src/scrapers/china/zhihu";
import { BilibiliScraper } from "../packages/collector/src/scrapers/sns/bilibili";
import { MastodonScraper } from "../packages/collector/src/scrapers/sns/mastodon";
import { YoutubeScraper } from "../packages/collector/src/scrapers/sns/youtube";
import { DcardScraper } from "../packages/collector/src/scrapers/taiwan/dcard";
import { PttScraper } from "../packages/collector/src/scrapers/taiwan/ptt";
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
    ppomppu: new PpomppuScraper(),
    ruliweb: new RuliwebScraper(),
    theqoo: new TheqooScraper(),
    fivech: new FivechScraper(),
    hatena: new HatenaScraper(),
    ptt: new PttScraper(),
    weibo: new WeiboScraper(),
    zhihu: new ZhihuScraper(),
    reddit: new RedditScraper(),
    reddit_worldnews: new RedditScraper("reddit_worldnews"),
    reddit_japan: new RedditScraper("reddit_japan"),
    reddit_japan_politics: new RedditScraper("reddit_japan_politics"),
    reddit_japan_tech: new RedditScraper("reddit_japan_tech"),
    reddit_kpop: new RedditScraper("reddit_kpop"),
    reddit_japanese: new RedditScraper("reddit_japanese"),
    reddit_taiwan: new RedditScraper("reddit_taiwan"),
    reddit_taiwanese: new RedditScraper("reddit_taiwanese"),
    reddit_taiwan_tech: new RedditScraper("reddit_taiwan_tech"),
    reddit_hongkong: new RedditScraper("reddit_hongkong"),
    reddit_politics: new RedditScraper("reddit_politics"),
    reddit_news: new RedditScraper("reddit_news"),
    reddit_science: new RedditScraper("reddit_science"),
    reddit_china: new RedditScraper("reddit_china"),
    reddit_korea: new RedditScraper("reddit_korea"),
    reddit_korea_opentalk: new RedditScraper("reddit_korea_opentalk"),
    reddit_europe: new RedditEuropeScraper(),
    reddit_eu_union: new RedditScraper("reddit_eu_union"),
    reddit_askuk: new RedditScraper("reddit_askuk"),
    reddit_greek: new RedditScraper("reddit_greek"),
    reddit_germany: new RedditScraper("reddit_germany"),
    reddit_france: new RedditScraper("reddit_france"),
    reddit_unitedkingdom: new RedditScraper("reddit_unitedkingdom"),
    reddit_spain: new RedditScraper("reddit_spain"),
    reddit_italy: new RedditScraper("reddit_italy"),
    reddit_mideast: new RedditMideastScraper(),
    reddit_mideast_arabic: new RedditScraper("reddit_mideast_arabic"),
    reddit_pakistan: new RedditScraper("reddit_pakistan"),
    reddit_israel: new RedditScraper("reddit_israel"),
    reddit_iran: new RedditScraper("reddit_iran"),
    reddit_turkey: new RedditScraper("reddit_turkey"),
    reddit_middleeast: new RedditScraper("reddit_middleeast"),
    reddit_russia: new RedditScraper("reddit_russia"),
    reddit_ukraine: new RedditScraper("reddit_ukraine"),
    reddit_belarus: new RedditScraper("reddit_belarus"),
    reddit_russian: new RedditScraper("reddit_russian"),
    fourchan: new FourchanScraper(),
    hackernews: new HackernewsScraper(),
    youtube_kr: new YoutubeScraper(),
    youtube_jp: new YoutubeScraper("youtube_jp"),
    youtube_us: new YoutubeScraper("youtube_us"),
    bilibili: new BilibiliScraper(),
    mastodon: new MastodonScraper(),
    dcard: new DcardScraper(),
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

