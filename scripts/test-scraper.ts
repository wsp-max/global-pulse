import { ClienScraper } from "../packages/collector/src/scrapers/korea/clien";
import { ArcaScraper } from "../packages/collector/src/scrapers/korea/arca";
import { DcInsideScraper } from "../packages/collector/src/scrapers/korea/dcinside";
import { RedditEuropeScraper } from "../packages/collector/src/scrapers/europe/reddit-europe";
import { FivechScraper } from "../packages/collector/src/scrapers/japan/fivech";
import { GirlschannelScraper } from "../packages/collector/src/scrapers/japan/girlschannel";
import { HatenaScraper } from "../packages/collector/src/scrapers/japan/hatena";
import { FmkoreaScraper } from "../packages/collector/src/scrapers/korea/fmkorea";
import { InstizScraper } from "../packages/collector/src/scrapers/korea/instiz";
import { InvenScraper } from "../packages/collector/src/scrapers/korea/inven";
import { PpomppuScraper } from "../packages/collector/src/scrapers/korea/ppomppu";
import { RuliwebScraper } from "../packages/collector/src/scrapers/korea/ruliweb";
import { TheqooScraper } from "../packages/collector/src/scrapers/korea/theqoo";
import { TogetterScraper } from "../packages/collector/src/scrapers/japan/togetter";
import { YahooJapanScraper } from "../packages/collector/src/scrapers/japan/yahoo-japan";
import { RedditMideastScraper } from "../packages/collector/src/scrapers/mideast/reddit-mideast";
import { JsonNewsScraper } from "../packages/collector/src/scrapers/news/json-news-scraper";
import { RankingNewsScraper } from "../packages/collector/src/scrapers/news/ranking-news-scraper";
import { RssNewsScraper } from "../packages/collector/src/scrapers/news/rss-news-scraper";
import { HabrScraper } from "../packages/collector/src/scrapers/russia/habr";
import { WeiboScraper } from "../packages/collector/src/scrapers/china/weibo";
import { ZhihuScraper } from "../packages/collector/src/scrapers/china/zhihu";
import { TiebaScraper } from "../packages/collector/src/scrapers/china/tieba";
import { GutefrageScraper } from "../packages/collector/src/scrapers/europe/gutefrage";
import { MumsnetScraper } from "../packages/collector/src/scrapers/europe/mumsnet";
import { BilibiliScraper } from "../packages/collector/src/scrapers/sns/bilibili";
import { MastodonScraper } from "../packages/collector/src/scrapers/sns/mastodon";
import { YoutubeScraper } from "../packages/collector/src/scrapers/sns/youtube";
import { BahamutScraper } from "../packages/collector/src/scrapers/taiwan/bahamut";
import { DcardScraper } from "../packages/collector/src/scrapers/taiwan/dcard";
import { Mobile01Scraper } from "../packages/collector/src/scrapers/taiwan/mobile01";
import { PttScraper } from "../packages/collector/src/scrapers/taiwan/ptt";
import { FarkScraper } from "../packages/collector/src/scrapers/us/fark";
import { FourchanScraper } from "../packages/collector/src/scrapers/us/fourchan";
import { HackernewsScraper } from "../packages/collector/src/scrapers/us/hackernews";
import { RedditScraper } from "../packages/collector/src/scrapers/us/reddit";
import { ReseteraScraper } from "../packages/collector/src/scrapers/us/resetera";
import { SlashdotScraper } from "../packages/collector/src/scrapers/us/slashdot";
import { SOURCES } from "@global-pulse/shared";
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
    inven: new InvenScraper(),
    instiz: new InstizScraper(),
    arca: new ArcaScraper(),
    fivech: new FivechScraper(),
    hatena: new HatenaScraper(),
    yahoo_japan: new YahooJapanScraper(),
    girlschannel: new GirlschannelScraper(),
    togetter: new TogetterScraper(),
    ptt: new PttScraper(),
    bahamut: new BahamutScraper(),
    mobile01: new Mobile01Scraper(),
    weibo: new WeiboScraper(),
    tieba: new TiebaScraper(),
    zhihu: new ZhihuScraper(),
    gutefrage: new GutefrageScraper(),
    mumsnet: new MumsnetScraper(),
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
    habr: new HabrScraper(),
    reddit_ukraine: new RedditScraper("reddit_ukraine"),
    reddit_belarus: new RedditScraper("reddit_belarus"),
    reddit_russian: new RedditScraper("reddit_russian"),
    reddit_brasil: new RedditScraper("reddit_brasil"),
    reddit_brazil: new RedditScraper("reddit_brazil"),
    reddit_brasilivre: new RedditScraper("reddit_brasilivre"),
    reddit_india: new RedditScraper("reddit_india"),
    reddit_indianews: new RedditScraper("reddit_indianews"),
    reddit_indiaspeaks: new RedditScraper("reddit_indiaspeaks"),
    reddit_developersindia: new RedditScraper("reddit_developersindia"),
    reddit_indonesia: new RedditScraper("reddit_indonesia"),
    reddit_jakarta: new RedditScraper("reddit_jakarta"),
    reddit_bali: new RedditScraper("reddit_bali"),
    reddit_mexico: new RedditScraper("reddit_mexico"),
    reddit_mexicocity: new RedditScraper("reddit_mexicocity"),
    reddit_australia: new RedditScraper("reddit_australia"),
    reddit_sydney: new RedditScraper("reddit_sydney"),
    reddit_vietnam: new RedditScraper("reddit_vietnam"),
    reddit_vietnamese: new RedditScraper("reddit_vietnamese"),
    reddit_thailand: new RedditScraper("reddit_thailand"),
    reddit_bangkok: new RedditScraper("reddit_bangkok"),
    reddit_argentina: new RedditScraper("reddit_argentina"),
    reddit_buenosaires: new RedditScraper("reddit_buenosaires"),
    reddit_canada: new RedditScraper("reddit_canada"),
    reddit_ontario: new RedditScraper("reddit_ontario"),
    reddit_nigeria: new RedditScraper("reddit_nigeria"),
    reddit_lagos: new RedditScraper("reddit_lagos"),
    reddit_southafrica: new RedditScraper("reddit_southafrica"),
    reddit_johannesburg: new RedditScraper("reddit_johannesburg"),
    fourchan: new FourchanScraper(),
    hackernews: new HackernewsScraper(),
    slashdot: new SlashdotScraper(),
    fark: new FarkScraper(),
    resetera: new ReseteraScraper(),
    youtube_kr: new YoutubeScraper(),
    youtube_jp: new YoutubeScraper("youtube_jp"),
    youtube_us: new YoutubeScraper("youtube_us"),
    youtube_me: new YoutubeScraper("youtube_me"),
    youtube_ru: new YoutubeScraper("youtube_ru"),
    bilibili: new BilibiliScraper(),
    mastodon: new MastodonScraper(),
    mastodon_me: new MastodonScraper("mastodon_me"),
    mastodon_ru: new MastodonScraper("mastodon_ru"),
    dcard: new DcardScraper(),
  } as const;

  let scraper = map[sourceId as keyof typeof map];

  if (!scraper) {
    const source = SOURCES.find((item) => item.id === sourceId);
    if (source?.type === "news") {
      if (source.feedKind === "json") {
        scraper = new JsonNewsScraper(source.id);
      } else if (source.feedKind === "html_ranking") {
        scraper = new RankingNewsScraper(source.id);
      } else {
        scraper = new RssNewsScraper(source.id);
      }
    }
  }

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

