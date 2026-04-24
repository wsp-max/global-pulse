import { DISABLED_SOURCE_ID_SET, SOURCES, type ScraperResult, type Source } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { TiebaScraper } from "./scrapers/china/tieba";
import { WeiboScraper } from "./scrapers/china/weibo";
import { ZhihuScraper } from "./scrapers/china/zhihu";
import { RssCommunityScraper } from "./scrapers/community/rss-community";
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
import { ExpatMideastScraper } from "./scrapers/mideast/expat-mideast";
import { RedditMideastScraper } from "./scrapers/mideast/reddit-mideast";
import { JsonNewsScraper } from "./scrapers/news/json-news-scraper";
import { RankingNewsScraper } from "./scrapers/news/ranking-news-scraper";
import { RssNewsScraper } from "./scrapers/news/rss-news-scraper";
import { BilibiliScraper } from "./scrapers/sns/bilibili";
import { BlueskyScraper } from "./scrapers/sns/bluesky";
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
import {
  isOptionalSourceId,
  resolveCollectorSourceIntervalMinutes,
} from "./utils/source-scaling";
import { persistScraperResult } from "./utils/supabase-storage";
import { recordCollectorRun, toCollectorRunErrorCode } from "./utils/collector-runs";

const DEFAULT_SCRAPER_TIMEOUT_MS = Number(process.env.COLLECTOR_SCRAPER_TIMEOUT_MS ?? 90_000);
const BROWSER_SCRAPER_TIMEOUT_MS = Number(process.env.COLLECTOR_BROWSER_TIMEOUT_MS ?? 150_000);
const MAX_COLLECTOR_RSS_MB = Number(process.env.COLLECTOR_MAX_RSS_MB ?? 1536);
const ENFORCE_SOURCE_INTERVAL = (process.env.COLLECTOR_ENFORCE_SOURCE_INTERVAL ?? "true").toLowerCase() !== "false";
const BROWSER_SOURCE_IDS = new Set<string>(["zhihu", "dcard", "tiktok", "threads"]);

interface SourceScheduleRow {
  id: string;
  is_active: boolean;
  scrape_interval_minutes: number | string | null;
  last_scraped_at: string | null;
}

function parseArg(flag: string): string | undefined {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function isDueByInterval(lastScrapedAt: string | null, intervalMinutes: number, nowMs: number): boolean {
  if (!lastScrapedAt) {
    return true;
  }
  const lastScrapedMs = new Date(lastScrapedAt).getTime();
  if (!Number.isFinite(lastScrapedMs)) {
    return true;
  }
  return nowMs >= lastScrapedMs + intervalMinutes * 60_000;
}

async function resolveDueSourceIds(
  sourceIds: string[],
  options: {
    forceRun: boolean;
    allowInactive: boolean;
  },
): Promise<Set<string> | null> {
  if (sourceIds.length === 0) {
    return new Set<string>();
  }

  if (options.forceRun || !ENFORCE_SOURCE_INTERVAL) {
    return new Set(sourceIds);
  }

  if (!hasPostgresConfig()) {
    return null;
  }

  const nowMs = Date.now();
  try {
    const pool = createPostgresPool();
    const { rows } = await pool.query<SourceScheduleRow>(
      `
      select id, is_active, scrape_interval_minutes, last_scraped_at
      from sources
      where id = any($1::text[])
      `,
      [sourceIds],
    );
    const byId = new Map<string, SourceScheduleRow>(rows.map((row) => [row.id, row]));
    const dueSourceIds = new Set<string>();
    const missingSourceRows: string[] = [];

    for (const sourceId of sourceIds) {
      const row = byId.get(sourceId);
      if (!row) {
        missingSourceRows.push(sourceId);
        continue;
      }

      if (!options.allowInactive && row.is_active === false) {
        continue;
      }

      const baseIntervalMinutes = Math.max(1, toNumber(row.scrape_interval_minutes, 30));
      const intervalMinutes = resolveCollectorSourceIntervalMinutes(sourceId, baseIntervalMinutes);
      if (isDueByInterval(row.last_scraped_at, intervalMinutes, nowMs)) {
        dueSourceIds.add(sourceId);
      }
    }

    if (missingSourceRows.length > 0) {
      const preview = missingSourceRows.slice(0, 10).join(", ");
      const suffix = missingSourceRows.length > 10 ? ` (+${missingSourceRows.length - 10} more)` : "";
      Logger.warn(
        `Skipping ${missingSourceRows.length} source(s) missing from DB sources table: ${preview}${suffix}. Run seed:regions to sync source metadata.`,
      );
    }

    return dueSourceIds;
  } catch (error) {
    Logger.warn(
      `Source interval guard skipped due to DB lookup failure: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

function isBrowserLikelySource(sourceId: string): boolean {
  if (BROWSER_SOURCE_IDS.has(sourceId)) {
    return true;
  }
  return sourceId.includes("threads") || sourceId.includes("tiktok");
}

function createNewsScraper(source: Source): {
  sourceId: string;
  scrape: () => Promise<ScraperResult>;
} | null {
  if (source.type !== "news") {
    return null;
  }

  if (source.feedKind === "json") {
    return new JsonNewsScraper(source.id);
  }
  if (source.feedKind === "html_ranking") {
    return new RankingNewsScraper(source.id);
  }
  return new RssNewsScraper(source.id);
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
  const forceRun = process.argv.includes("--force") || process.env.COLLECTOR_FORCE_RUN === "true";
  const allowInactive = process.argv.includes("--allow-inactive");
  const includeOptional = process.argv.includes("--include-optional");
  const optionalOnly = process.argv.includes("--optional-only");
  const sourceFilter = sourceArg
    ? sourceArg
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const typeFilter =
    typeFilterRaw === "community" || typeFilterRaw === "sns" || typeFilterRaw === "news"
      ? typeFilterRaw
      : undefined;

  if (typeFilterRaw && !typeFilter) {
    Logger.error(`Invalid --type value "${typeFilterRaw}". Allowed: community | sns | news`);
    process.exit(1);
  }

  const communityAndSnsScrapers = [
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
    new RedditScraper("reddit_brasil"),
    new RedditScraper("reddit_brazil"),
    new RedditScraper("reddit_brasilivre"),
    new RedditScraper("reddit_india"),
    new RedditScraper("reddit_indianews"),
    new RedditScraper("reddit_indiaspeaks"),
    new RedditScraper("reddit_developersindia"),
    new RedditScraper("reddit_indonesia"),
    new RedditScraper("reddit_jakarta"),
    new RedditScraper("reddit_bali"),
    new RedditScraper("reddit_mexico"),
    new RedditScraper("reddit_mexicocity"),
    new RedditScraper("reddit_australia"),
    new RedditScraper("reddit_sydney"),
    new RedditScraper("reddit_vietnam"),
    new RedditScraper("reddit_vietnamese"),
    new RedditScraper("reddit_thailand"),
    new RedditScraper("reddit_bangkok"),
    new RedditScraper("reddit_argentina"),
    new RedditScraper("reddit_buenosaires"),
    new RedditScraper("reddit_canada"),
    new RedditScraper("reddit_ontario"),
    new RedditScraper("reddit_nigeria"),
    new RedditScraper("reddit_lagos"),
    new RedditScraper("reddit_southafrica"),
    new RedditScraper("reddit_johannesburg"),
    new HabrScraper(),
    new RedditScraper("reddit_politics"),
    new RedditScraper("reddit_news"),
    new FourchanScraper(),
    new HackernewsScraper(),
    new SlashdotScraper(),
    new FarkScraper(),
    new ReseteraScraper(),
    new RssCommunityScraper("metafilter_rss"),
    new RssCommunityScraper("lobsters_rss"),
    new RssCommunityScraper("neogaf_gaming_rss"),
    new RssCommunityScraper("hardware_fr_rss"),
    new ExpatMideastScraper(),
    new RssCommunityScraper("dtf_rss"),
    new RssCommunityScraper("vc_ru_rss"),
    new RssCommunityScraper("ozbargain_rss"),
    new RssCommunityScraper("redflagdeals_forum_rss"),
    new RssCommunityScraper("nairaland_rss"),
    new RssCommunityScraper("wilddog_za_rss"),
    new RssCommunityScraper("carbonite_za_rss"),
    new RssCommunityScraper("pantip_forum_rss"),
    new RssCommunityScraper("voz_forum_rss"),
    new RssCommunityScraper("tinhte_rss"),
    new RssCommunityScraper("adrenaline_forum_rss"),
    new RssCommunityScraper("teambhp_forum_rss"),
    new RssCommunityScraper("skyscrapercity_mx_rss"),
    new RssCommunityScraper("skyscrapercity_ar_rss"),
    new RssCommunityScraper("kaskus_rss"),
    new YoutubeScraper("youtube_kr"),
    new YoutubeScraper("youtube_jp"),
    new YoutubeScraper("youtube_us"),
    new YoutubeScraper("youtube_me"),
    new YoutubeScraper("youtube_ru"),
    new BilibiliScraper(),
    new BlueskyScraper("bluesky_kr"),
    new BlueskyScraper("bluesky_jp"),
    new BlueskyScraper("bluesky_tw"),
    new BlueskyScraper("bluesky_cn"),
    new BlueskyScraper("bluesky_us"),
    new BlueskyScraper("bluesky_eu"),
    new BlueskyScraper("bluesky_me"),
    new BlueskyScraper("bluesky_ru"),
    new MastodonScraper("mastodon_kr"),
    new MastodonScraper("mastodon_jp"),
    new MastodonScraper("mastodon_tw"),
    new MastodonScraper("mastodon_cn"),
    new MastodonScraper("mastodon_us"),
    new MastodonScraper("mastodon_eu"),
    new MastodonScraper("mastodon_me"),
    new MastodonScraper("mastodon_ru"),
    new DcardScraper(),
  ];
  const newsScrapers = SOURCES.filter((source) => source.type === "news")
    .map((source) => createNewsScraper(source))
    .filter((scraper): scraper is NonNullable<ReturnType<typeof createNewsScraper>> => Boolean(scraper));
  const candidateScrapers = [...communityAndSnsScrapers, ...newsScrapers];
  const sourceById = new Map(SOURCES.map((source) => [source.id, source]));
  const optionalSkippedByPolicy = new Set<string>();
  const disabledSkippedByDefault = new Set<string>();
  const explicitSourceMode = sourceFilter.length > 0;

  if (sourceFilter.length > 0) {
    const sourceIdSet = new Set<string>(SOURCES.map((source) => source.id));
    const unknown = sourceFilter.filter((sourceId) => !sourceIdSet.has(sourceId));
    if (unknown.length > 0) {
      Logger.warn(`Unknown source IDs ignored: ${unknown.join(", ")}`);
    }
  }

  const scrapers = candidateScrapers.filter((scraper) => {
    const source = sourceById.get(scraper.sourceId);
    if (!source) {
      return false;
    }

    if (explicitSourceMode && !sourceFilter.includes(source.id)) {
      return false;
    }

    if (regionFilter && source.regionId !== regionFilter) {
      return false;
    }

    if (typeFilter && source.type !== typeFilter) {
      return false;
    }

    if (!allowInactive && "isActive" in source && source.isActive === false) {
      return false;
    }

    if (optionalOnly && !isOptionalSourceId(source.id)) {
      return false;
    }

    if (!explicitSourceMode && !includeOptional && !optionalOnly && isOptionalSourceId(source.id)) {
      optionalSkippedByPolicy.add(source.id);
      return false;
    }

    if (!explicitSourceMode && DISABLED_SOURCE_ID_SET.has(source.id)) {
      disabledSkippedByDefault.add(source.id);
      return false;
    }

    return true;
  });

  if (scrapers.length === 0) {
    Logger.warn("No scrapers matched the provided filters.");
    return;
  }

  const dueSourceIds = await resolveDueSourceIds(
    scrapers.map((scraper) => scraper.sourceId),
    {
      forceRun,
      allowInactive,
    },
  );
  const scheduledScrapers =
    dueSourceIds === null
      ? scrapers
      : scrapers.filter((scraper) => dueSourceIds.has(scraper.sourceId));

  if (scheduledScrapers.length === 0) {
    Logger.info("No sources are due by scrape interval. Nothing to collect.");
    return;
  }

  const intervalSkippedCount = Math.max(0, scrapers.length - scheduledScrapers.length);
  Logger.info(
    `Filters => region: ${regionFilter ?? "all"}, type: ${typeFilter ?? "all"}, source: ${
      sourceFilter.length > 0 ? sourceFilter.join(",") : "all"
    }, force: ${forceRun}, allowInactive: ${allowInactive}, includeOptional: ${includeOptional}, optionalOnly: ${optionalOnly}`,
  );
  if (!explicitSourceMode && optionalSkippedByPolicy.size > 0) {
    Logger.info(`Optional sources skipped in default collector: ${optionalSkippedByPolicy.size}`);
  }
  if (!explicitSourceMode && disabledSkippedByDefault.size > 0) {
    Logger.info(`Disabled-by-default sources skipped: ${disabledSkippedByDefault.size}`);
  }
  Logger.info(
    `Batch summary => scheduled=${scheduledScrapers.length}, dueIntervalSkipped=${intervalSkippedCount}, optionalSkipped=${optionalSkippedByPolicy.size}, disabledSkipped=${disabledSkippedByDefault.size}`,
  );

  const results: ScraperResult[] = [];
  let successCount = 0;
  let failedCount = 0;
  let autoDisabledCount = 0;
  const successByRegion = new Map<string, Set<string>>();

  for (const scraper of scheduledScrapers) {
    const startedAtIso = new Date().toISOString();
    const startedAtMs = Date.now();
    assertCollectorMemoryBudget(scraper.sourceId);
    const timeoutMs = getScraperTimeoutMs(scraper.sourceId);

    Logger.info(`Collecting from ${scraper.sourceId}...`);
    Logger.info(
      `[${scraper.sourceId}] guardrails: timeout=${timeoutMs}ms, rss_limit=${MAX_COLLECTOR_RSS_MB}MB`,
    );
    const result = await scrapeWithTimeout(scraper.sourceId, () => scraper.scrape(), timeoutMs);
    results.push(result);

    const persistence = await persistScraperResult(result);
    const finishedAtIso = new Date().toISOString();
    const collectorStatus = result.success && persistence.persisted ? "success" : "failed";
    const runErrorMessage =
      result.success && persistence.persisted
        ? null
        : (result.error ?? persistence.errorMessage ?? "collector_or_persistence_failed");
    const runOutcome = await recordCollectorRun({
      sourceId: scraper.sourceId,
      startedAt: startedAtIso,
      finishedAt: finishedAtIso,
      status: collectorStatus,
      fetchedCount: result.posts.length,
      insertedCount: persistence.insertedCount,
      latencyMs: Math.max(1, Date.now() - startedAtMs),
      errorCode: toCollectorRunErrorCode(runErrorMessage, scraper.sourceId),
      errorMessage: runErrorMessage,
    });

    if (collectorStatus === "success") {
      successCount += 1;
      const sourceMeta = sourceById.get(scraper.sourceId);
      if (sourceMeta) {
        const set = successByRegion.get(sourceMeta.regionId) ?? new Set<string>();
        set.add(scraper.sourceId);
        successByRegion.set(sourceMeta.regionId, set);
      }
    } else {
      failedCount += 1;
    }

    if (!persistence.persisted) {
      Logger.warn(
        `[${scraper.sourceId}] persistence failed; collector run marked failed for observability`,
      );
    }

    if (runOutcome.autoDisabled) {
      autoDisabledCount += 1;
      Logger.warn(`[${scraper.sourceId}] auto-disabled in sources after 3 consecutive failures`);
    }

    if (!result.success) {
      Logger.error(`[${scraper.sourceId}] failed: ${result.error ?? "unknown error"}`);
      continue;
    }

    Logger.info(`[${scraper.sourceId}] collected ${result.posts.length} posts.`);
  }

  const regionSuccessSummary = [...successByRegion.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([regionId, sourceIds]) => `${regionId}:${sourceIds.size}`)
    .join(", ");
  Logger.info(
    `Collection finished: scheduled=${scheduledScrapers.length}, success=${successCount}, failed=${failedCount}, autoDisabled=${autoDisabledCount}${
      regionSuccessSummary ? `, regionSuccess={${regionSuccessSummary}}` : ""
    }`,
  );
}

run().catch((error) => {
  Logger.error(`Collector crashed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
