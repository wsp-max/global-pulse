import { DISABLED_SOURCE_ID_SET, SOURCES, type ScraperResult } from "@global-pulse/shared";
import { TiebaScraper } from "./scrapers/china/tieba";
import { WeiboScraper } from "./scrapers/china/weibo";
import { ZhihuScraper } from "./scrapers/china/zhihu";
import { GutefrageScraper } from "./scrapers/europe/gutefrage";
import { MumsnetScraper } from "./scrapers/europe/mumsnet";
import { ClienScraper } from "./scrapers/korea/clien";
import { ArcaScraper } from "./scrapers/korea/arca";
import { DcInsideScraper } from "./scrapers/korea/dcinside";
import { FmkoreaScraper } from "./scrapers/korea/fmkorea";
import { InstizScraper } from "./scrapers/korea/instiz";
import { InvenScraper } from "./scrapers/korea/inven";
import { PpomppuScraper } from "./scrapers/korea/ppomppu";
import { RuliwebScraper } from "./scrapers/korea/ruliweb";
import { TheqooScraper } from "./scrapers/korea/theqoo";
import { RedditEuropeScraper } from "./scrapers/europe/reddit-europe";
import { FivechScraper } from "./scrapers/japan/fivech";
import { GirlschannelScraper } from "./scrapers/japan/girlschannel";
import { HatenaScraper } from "./scrapers/japan/hatena";
import { TogetterScraper } from "./scrapers/japan/togetter";
import { YahooJapanScraper } from "./scrapers/japan/yahoo-japan";
import { RedditMideastScraper } from "./scrapers/mideast/reddit-mideast";
import { BilibiliScraper } from "./scrapers/sns/bilibili";
import { MastodonScraper } from "./scrapers/sns/mastodon";
import { YoutubeScraper } from "./scrapers/sns/youtube";
import { HabrScraper } from "./scrapers/russia/habr";
import { BahamutScraper } from "./scrapers/taiwan/bahamut";
import { DcardScraper } from "./scrapers/taiwan/dcard";
import { Mobile01Scraper } from "./scrapers/taiwan/mobile01";
import { PttScraper } from "./scrapers/taiwan/ptt";
import { FarkScraper } from "./scrapers/us/fark";
import { FourchanScraper } from "./scrapers/us/fourchan";
import { HackernewsScraper } from "./scrapers/us/hackernews";
import { RedditScraper } from "./scrapers/us/reddit";
import { ReseteraScraper } from "./scrapers/us/resetera";
import { SlashdotScraper } from "./scrapers/us/slashdot";
import { Logger } from "./utils/logger";
import { persistScraperResult } from "./utils/supabase-storage";

const DEFAULT_SCRAPER_TIMEOUT_MS = Number(process.env.COLLECTOR_SCRAPER_TIMEOUT_MS ?? 90_000);
const BROWSER_SCRAPER_TIMEOUT_MS = Number(process.env.COLLECTOR_BROWSER_TIMEOUT_MS ?? 150_000);
const MAX_COLLECTOR_RSS_MB = Number(process.env.COLLECTOR_MAX_RSS_MB ?? 1536);
const BROWSER_SOURCE_IDS = new Set<string>(["zhihu", "dcard", "tiktok", "threads"]);

function parseArg(flag: string): string | undefined {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function isBrowserLikelySource(sourceId: string): boolean {
  if (BROWSER_SOURCE_IDS.has(sourceId)) {
    return true;
  }
  return sourceId.includes("threads") || sourceId.includes("tiktok");
}

function getScraperTimeoutMs(sourceId: string): number {
  return isBrowserLikelySource(sourceId) ? BROWSER_SCRAPER_TIMEOUT_MS : DEFAULT_SCRAPER_TIMEOUT_MS;
}

function assertCollectorMemoryBudget(sourceId: string): void {
  const rssMb = process.memoryUsage().rss / (1024 * 1024);
  if (rssMb > MAX_COLLECTOR_RSS_MB) {
    throw new Error(
      `memory_budget_exceeded before ${sourceId}: rss=${rssMb.toFixed(1)}MB limit=${MAX_COLLECTOR_RSS_MB}MB`,
    );
  }
}

async function scrapeWithTimeout(
  sourceId: string,
  runner: () => Promise<ScraperResult>,
  timeoutMs: number,
): Promise<ScraperResult> {
  let timeoutRef: NodeJS.Timeout | null = null;
  const timeoutResult = new Promise<ScraperResult>((resolve) => {
    timeoutRef = setTimeout(() => {
      resolve({
        sourceId,
        posts: [],
        scrapedAt: new Date().toISOString(),
        success: false,
        error: `timeout after ${timeoutMs}ms`,
      });
    }, timeoutMs);
  });

  const result = await Promise.race([runner(), timeoutResult]);
  if (timeoutRef) {
    clearTimeout(timeoutRef);
  }
  return result;
}

async function run(): Promise<void> {
  const regionFilter = parseArg("--region");
  const typeFilterRaw = parseArg("--type");
  const sourceArg = parseArg("--source");
  const sourceFilter = sourceArg
    ? sourceArg
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const typeFilter =
    typeFilterRaw === "community" || typeFilterRaw === "sns" ? typeFilterRaw : undefined;

  if (typeFilterRaw && !typeFilter) {
    Logger.error(`Invalid --type value "${typeFilterRaw}". Allowed: community | sns`);
    process.exit(1);
  }

  const candidateScrapers = [
    new DcInsideScraper(),
    new FmkoreaScraper(),
    new ClienScraper(),
    new PpomppuScraper(),
    new RuliwebScraper(),
    new TheqooScraper(),
    new InvenScraper(),
    new InstizScraper(),
    new ArcaScraper(),
    new FivechScraper(),
    new HatenaScraper(),
    new YahooJapanScraper(),
    new GirlschannelScraper(),
    new TogetterScraper(),
    new PttScraper(),
    new BahamutScraper(),
    new Mobile01Scraper(),
    new WeiboScraper(),
    new TiebaScraper(),
    new ZhihuScraper(),
    new GutefrageScraper(),
    new MumsnetScraper(),
    new RedditScraper(),
    new RedditScraper("reddit_worldnews"),
    new RedditScraper("reddit_japan"),
    new RedditScraper("reddit_japan_politics"),
    new RedditScraper("reddit_japan_tech"),
    new RedditScraper("reddit_japanese"),
    new RedditScraper("reddit_kpop"),
    new RedditScraper("reddit_taiwan"),
    new RedditScraper("reddit_taiwanese"),
    new RedditScraper("reddit_taiwan_tech"),
    new RedditScraper("reddit_hongkong"),
    new RedditScraper("reddit_science"),
    new RedditScraper("reddit_china"),
    new RedditScraper("reddit_korea"),
    new RedditScraper("reddit_korea_opentalk"),
    new RedditEuropeScraper(),
    new RedditScraper("reddit_eu_union"),
    new RedditScraper("reddit_askuk"),
    new RedditScraper("reddit_greek"),
    new RedditScraper("reddit_germany"),
    new RedditScraper("reddit_france"),
    new RedditScraper("reddit_unitedkingdom"),
    new RedditScraper("reddit_spain"),
    new RedditScraper("reddit_italy"),
    new RedditMideastScraper(),
    new RedditScraper("reddit_mideast_arabic"),
    new RedditScraper("reddit_pakistan"),
    new RedditScraper("reddit_israel"),
    new RedditScraper("reddit_iran"),
    new RedditScraper("reddit_turkey"),
    new RedditScraper("reddit_middleeast"),
    new RedditScraper("reddit_russia"),
    new RedditScraper("reddit_ukraine"),
    new RedditScraper("reddit_belarus"),
    new RedditScraper("reddit_russian"),
    new HabrScraper(),
    new RedditScraper("reddit_politics"),
    new RedditScraper("reddit_news"),
    new FourchanScraper(),
    new HackernewsScraper(),
    new SlashdotScraper(),
    new FarkScraper(),
    new ReseteraScraper(),
    new YoutubeScraper("youtube_kr"),
    new YoutubeScraper("youtube_jp"),
    new YoutubeScraper("youtube_us"),
    new YoutubeScraper("youtube_me"),
    new YoutubeScraper("youtube_ru"),
    new BilibiliScraper(),
    new MastodonScraper(),
    new MastodonScraper("mastodon_me"),
    new MastodonScraper("mastodon_ru"),
    new DcardScraper(),
  ];

  if (sourceFilter.length > 0) {
    const sourceIdSet = new Set<string>(SOURCES.map((source) => source.id));
    const unknown = sourceFilter.filter((sourceId) => !sourceIdSet.has(sourceId));
    if (unknown.length > 0) {
      Logger.warn(`Unknown source IDs ignored: ${unknown.join(", ")}`);
    }
  }

  const scrapers = candidateScrapers.filter((scraper) => {
    const source = SOURCES.find((item) => item.id === scraper.sourceId);
    if (!source) {
      return false;
    }

    if (sourceFilter.length > 0 && !sourceFilter.includes(source.id)) {
      return false;
    }

    if (regionFilter && source.regionId !== regionFilter) {
      return false;
    }

    if (typeFilter && source.type !== typeFilter) {
      return false;
    }

    if (sourceFilter.length === 0 && DISABLED_SOURCE_ID_SET.has(source.id)) {
      return false;
    }

    return true;
  });

  if (scrapers.length === 0) {
    Logger.warn("No scrapers matched the provided filters.");
    return;
  }

  Logger.info(
    `Filters => region: ${regionFilter ?? "all"}, type: ${typeFilter ?? "all"}, source: ${
      sourceFilter.length > 0 ? sourceFilter.join(",") : "all"
    }`,
  );
  if (sourceFilter.length === 0) {
    const disabledByDefault = SOURCES.filter((source) => DISABLED_SOURCE_ID_SET.has(source.id)).map(
      (source) => source.id,
    );
    if (disabledByDefault.length > 0) {
      Logger.info(`Disabled-by-default sources skipped: ${disabledByDefault.join(", ")}`);
    }
  }
  Logger.info(`Starting collection for ${scrapers.length} source(s).`);

  const results: ScraperResult[] = [];

  for (const scraper of scrapers) {
    assertCollectorMemoryBudget(scraper.sourceId);
    const timeoutMs = getScraperTimeoutMs(scraper.sourceId);

    Logger.info(`Collecting from ${scraper.sourceId}...`);
    Logger.info(
      `[${scraper.sourceId}] guardrails: timeout=${timeoutMs}ms, rss_limit=${MAX_COLLECTOR_RSS_MB}MB`,
    );
    const result = await scrapeWithTimeout(scraper.sourceId, () => scraper.scrape(), timeoutMs);
    results.push(result);

    await persistScraperResult(result);

    if (!result.success) {
      Logger.error(`[${scraper.sourceId}] failed: ${result.error ?? "unknown error"}`);
      continue;
    }

    Logger.info(`[${scraper.sourceId}] collected ${result.posts.length} posts.`);
  }

  const successCount = results.filter((r) => r.success).length;
  Logger.info(`Collection finished: ${successCount}/${results.length} succeeded.`);
}

run().catch((error) => {
  Logger.error(`Collector crashed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

