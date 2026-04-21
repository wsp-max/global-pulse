import { NEWS_SOURCES, type ScrapedPost } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";
import { JsonNewsScraper } from "../packages/collector/src/scrapers/news/json-news-scraper";
import { RankingNewsScraper } from "../packages/collector/src/scrapers/news/ranking-news-scraper";
import { RssNewsScraper } from "../packages/collector/src/scrapers/news/rss-news-scraper";
import {
  KEEP_DISABLED_SOURCE_ID_SET,
  type SourcePolicyType,
} from "./lib/source-policy";

type NewsSource = (typeof NEWS_SOURCES)[number];

interface FeedProbeResult {
  sourceId: string;
  regionId: string;
  feedKind: string;
  url: string;
  isActive: boolean;
  status: number | null;
  reachable: boolean;
  itemCount: number;
  validArticleCount: number;
  badTitleCount: number;
  ok: boolean;
  shouldActivate: boolean;
  desiredPolicy: SourcePolicyType;
  reason: string;
  sampleTitles: string[];
}

interface QualityResult {
  itemCount: number;
  validArticleCount: number;
  badTitleCount: number;
  ok: boolean;
  reason: string;
  sampleTitles: string[];
}

const logger = getLogger("verify-news-feeds");
const REQUEST_TIMEOUT_MS = Number(process.env.VERIFY_NEWS_FEEDS_TIMEOUT_MS ?? 12_000);
const MAX_CONCURRENCY = Math.max(1, Math.min(Number(process.env.VERIFY_NEWS_FEEDS_CONCURRENCY ?? 4), 12));
const USER_AGENT = "GlobalPulseBot/1.0 news-research (+mailto:ops@globalpulse.dev)";

const NON_ARTICLE_TITLE_PATTERNS = [
  /^新闻首页$/i,
  /^新浪首页$/i,
  /^新浪导航$/i,
  /^每周新闻排行$/i,
  /^更多(?:视频新闻|图片|国内新闻|国际新闻|社会新闻|体育新闻|财经新闻|娱乐新闻|科技新闻|军事新闻)?[>＞»]*$/i,
  /^新闻中心意见反馈留言板$/i,
  /^新浪网产品客户服务联系电话$/i,
  /^新浪简介$/i,
  /^About Sina$/i,
  /^SINA English$/i,
  /^广告服务$/i,
  /^联系我们$/i,
  /^招聘信息$/i,
  /^网站律师$/i,
  /^会员注册$/i,
  /^产品答疑$/i,
  /^版权所有$/i,
  /^网易(?:首页|新闻|公开课|红彩|严选|云课堂|智能)$/i,
  /^(?:邮箱大师|快速导航|封面故事|北京房产|上海房产|广州房产|设计师库|查看网易地图)$/i,
  /^注册(?:免费邮箱|VIP邮箱)/i,
  /^免费下载网易官方手机邮箱应用$/i,
  /^安全退出$/i,
  /^一卡通(?:充值|购买)$/i,
  /^我的网易支付$/i,
  /^更多(?:\s+icon_[A-Za-z0-9_]+)?$/i,
  /^QQ空间$/i,
  /^Pic_logo_graphics(?:\s+新闻)?$/i,
];

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseListArg(...flags: string[]): string[] {
  const values = flags.flatMap((flag) => {
    const raw = parseArg(flag);
    if (!raw) {
      return [];
    }
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });

  return [...new Set(values)];
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);

  if (!signal) {
    timeoutController.signal.addEventListener("abort", () => clearTimeout(timeout), { once: true });
    return timeoutController.signal;
  }

  const merged = new AbortController();
  const abort = () => merged.abort();
  signal.addEventListener("abort", abort, { once: true });
  timeoutController.signal.addEventListener("abort", abort, { once: true });
  merged.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      timeoutController.signal.removeEventListener("abort", abort);
    },
    { once: true },
  );
  return merged.signal;
}

async function probeUrl(url: string): Promise<{ status: number | null; ok: boolean; message: string }> {
  const signal = withTimeout(undefined, REQUEST_TIMEOUT_MS);

  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/atom+xml, application/json, text/html;q=0.9,*/*;q=0.8",
      },
    });

    if (head.ok) {
      return { status: head.status, ok: true, message: "HEAD ok" };
    }

    if ([401, 403, 404, 405].includes(head.status) || !head.ok) {
      const getResp = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: withTimeout(undefined, REQUEST_TIMEOUT_MS),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/atom+xml, application/json, text/html;q=0.9,*/*;q=0.8",
        },
      });

      return {
        status: getResp.status,
        ok: getResp.ok,
        message: getResp.ok ? "GET fallback ok" : `GET fallback failed (${getResp.status})`,
      };
    }
  } catch (error) {
    return {
      status: null,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    status: null,
    ok: false,
    message: "probe completed without a terminal response",
  };
}

function buildScraper(source: NewsSource): {
  scrape: () => Promise<{ success: boolean; posts: ScrapedPost[]; error?: string }>;
} {
  if (source.feedKind === "json") {
    return new JsonNewsScraper(source.id);
  }
  if (source.feedKind === "html_ranking") {
    return new RankingNewsScraper(source.id);
  }
  return new RssNewsScraper(source.id);
}

function isLikelyNoiseTitle(title: string): boolean {
  return NON_ARTICLE_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()));
}

function resolveUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url || url.startsWith("javascript:") || url.startsWith("#")) {
    return undefined;
  }

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function isLikelyArticleUrl(url: string | undefined, source: NewsSource): boolean {
  const resolved = resolveUrl(url, source.scrapeUrl);
  if (!resolved) {
    return false;
  }

  const parsed = new URL(resolved);
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  if (pathname === "/" || pathname === "") {
    return false;
  }

  if (/\/(?:guide|help|guest|intro|contact|contactus|register|login|client|download|sitemap)\b/.test(pathname)) {
    return false;
  }

  if (
    host.includes("qzone.qq.com") ||
    host.includes("corp.sina.com.cn") ||
    host.includes("ads.sina.com.cn") ||
    host.includes("help.sina.com.cn") ||
    host.includes("login.sina.com.cn") ||
    host.includes("track.sohu.com")
  ) {
    return false;
  }

  if (
    host === "mail.163.com" ||
    host === "open.163.com" ||
    host === "study.163.com" ||
    host === "you.163.com" ||
    host === "epay.163.com" ||
    host === "hongcai.163.com" ||
    host === "designer.home.163.com" ||
    host === "sitemap.163.com" ||
    host === "bj.house.163.com" ||
    host === "sh.house.163.com" ||
    host === "gz.house.163.com"
  ) {
    return false;
  }

  if (source.id === "sohu_news_ranking") {
    return /\/a\/\d+/.test(resolved);
  }

  if (source.id === "163_news_ranking") {
    return /163\.com\/(?:news|dy|sports|ent|tech|money|edu|game|travel|lady|auto)\//.test(resolved);
  }

  if (source.id === "sina_news_ranking") {
    return pathname.endsWith(".shtml") || /\/doc-/.test(pathname) || /\/20\d{2}-\d{2}-\d{2}\//.test(pathname);
  }

  return true;
}

function evaluatePosts(source: NewsSource, posts: ScrapedPost[]): QualityResult {
  const itemCount = posts.length;
  if (itemCount === 0) {
    return {
      itemCount,
      validArticleCount: 0,
      badTitleCount: 0,
      ok: false,
      reason: "no_items",
      sampleTitles: [],
    };
  }

  const badTitleCount = posts.filter((post) => isLikelyNoiseTitle(post.title)).length;
  const validArticleCount = posts.filter(
    (post) => !isLikelyNoiseTitle(post.title) && isLikelyArticleUrl(post.url, source),
  ).length;
  const sampleTitles = posts
    .filter((post) => !isLikelyNoiseTitle(post.title))
    .slice(0, 5)
    .map((post) => post.title);

  if (itemCount < 5) {
    return {
      itemCount,
      validArticleCount,
      badTitleCount,
      ok: false,
      reason: `insufficient_items:${itemCount}`,
      sampleTitles,
    };
  }

  if (source.feedKind === "html_ranking") {
    if (validArticleCount < 8) {
      return {
        itemCount,
        validArticleCount,
        badTitleCount,
        ok: false,
        reason: `insufficient_article_links:${validArticleCount}/${itemCount}`,
        sampleTitles,
      };
    }

    if (badTitleCount > Math.floor(itemCount * 0.2)) {
      return {
        itemCount,
        validArticleCount,
        badTitleCount,
        ok: false,
        reason: `too_many_noise_titles:${badTitleCount}/${itemCount}`,
        sampleTitles,
      };
    }
  }

  return {
    itemCount,
    validArticleCount,
    badTitleCount,
    ok: true,
    reason: "ok",
    sampleTitles,
  };
}

async function probeSource(source: NewsSource): Promise<FeedProbeResult> {
  const reachability = await probeUrl(source.scrapeUrl);
  const keepDisabled = KEEP_DISABLED_SOURCE_ID_SET.has(source.id);

  if (!reachability.ok) {
    return {
      sourceId: source.id,
      regionId: source.regionId,
      feedKind: source.feedKind ?? "unknown",
      url: source.scrapeUrl,
      isActive: source.isActive !== false,
      status: reachability.status,
      reachable: false,
      itemCount: 0,
      validArticleCount: 0,
      badTitleCount: 0,
      ok: false,
      shouldActivate: false,
      desiredPolicy: keepDisabled ? "keep-disabled" : "disable-until-fixed",
      reason: reachability.message,
      sampleTitles: [],
    };
  }

  const scraper = buildScraper(source);
  const result = await scraper.scrape();
  if (!result.success) {
    return {
      sourceId: source.id,
      regionId: source.regionId,
      feedKind: source.feedKind ?? "unknown",
      url: source.scrapeUrl,
      isActive: source.isActive !== false,
      status: reachability.status,
      reachable: true,
      itemCount: 0,
      validArticleCount: 0,
      badTitleCount: 0,
      ok: false,
      shouldActivate: false,
      desiredPolicy: keepDisabled ? "keep-disabled" : "disable-until-fixed",
      reason: result.error ?? "scrape_failed",
      sampleTitles: [],
    };
  }

  const quality = evaluatePosts(source, result.posts);
  const shouldActivate = quality.ok && !keepDisabled;
  const desiredPolicy: SourcePolicyType = shouldActivate
    ? "active"
    : keepDisabled
      ? "keep-disabled"
      : "disable-until-fixed";

  return {
    sourceId: source.id,
    regionId: source.regionId,
    feedKind: source.feedKind ?? "unknown",
    url: source.scrapeUrl,
    isActive: source.isActive !== false,
    status: reachability.status,
    reachable: true,
    itemCount: quality.itemCount,
    validArticleCount: quality.validArticleCount,
    badTitleCount: quality.badTitleCount,
    ok: quality.ok,
    shouldActivate,
    desiredPolicy,
    reason: keepDisabled && quality.ok ? "policy_keep_disabled" : quality.reason,
    sampleTitles: quality.sampleTitles,
  };
}

async function runWorker(queue: NewsSource[], results: FeedProbeResult[]): Promise<void> {
  while (queue.length > 0) {
    const source = queue.shift();
    if (!source) {
      return;
    }

    results.push(await probeSource(source));
  }
}

async function applyActivation(results: FeedProbeResult[]): Promise<void> {
  if (!hasPostgresConfig()) {
    throw new Error("Cannot apply activation: PostgreSQL configuration is missing.");
  }

  const targetSourceIds = results.map((result) => result.sourceId);
  const activeSourceIds = results.filter((result) => result.shouldActivate).map((result) => result.sourceId);
  if (targetSourceIds.length === 0) {
    return;
  }

  const pool = createPostgresPool();
  await pool.query(
    `
    update sources
    set is_active = (id = any($2::text[]))
    where id = any($1::text[])
    `,
    [targetSourceIds, activeSourceIds],
  );
}

async function main(): Promise<void> {
  const regionIds = parseListArg("--region", "--regions");
  const sourceIds = parseListArg("--source");
  const apply = process.argv.includes("--apply");

  const sources = NEWS_SOURCES.filter((source) => {
    if (regionIds.length > 0 && !regionIds.includes(source.regionId)) {
      return false;
    }
    if (sourceIds.length > 0 && !sourceIds.includes(source.id)) {
      return false;
    }
    return true;
  }) as NewsSource[];

  const queue = [...sources];
  const results: FeedProbeResult[] = [];
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length || 1) }, () =>
    runWorker(queue, results),
  );
  await Promise.all(workers);

  const sorted = [...results].sort((a, b) => a.regionId.localeCompare(b.regionId) || a.sourceId.localeCompare(b.sourceId));

  if (apply) {
    await applyActivation(sorted);
  }

  const summary = {
    total: sorted.length,
    regions: regionIds.length > 0 ? regionIds : ["all"],
    verified: sorted.filter((result) => result.ok).length,
    shouldActivate: sorted.filter((result) => result.shouldActivate).length,
    activePolicy: sorted.filter((result) => result.desiredPolicy === "active").length,
    keepDisabled: sorted.filter((result) => result.desiredPolicy === "keep-disabled").length,
    disableUntilFixed: sorted.filter((result) => result.desiredPolicy === "disable-until-fixed").length,
    timestamp: new Date().toISOString(),
    applied: apply,
  };

  logger.info(
    `news_feed_verification total=${summary.total} verified=${summary.verified} shouldActivate=${summary.shouldActivate} apply=${apply}`,
  );
  process.stdout.write(`${JSON.stringify({ summary, results: sorted }, null, 2)}\n`);
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
