import { createHash } from "node:crypto";
import { SOURCES, type ScrapedPost, type Source } from "@global-pulse/shared";
import { BaseScraper } from "../base-scraper";
import { fetchWithRetry } from "../../utils/http-client";
import {
  extractNumericCount,
  normalizePublishedAt,
  sanitizeNewsBodyPreview,
  sanitizeNewsTitle,
  sanitizeNewsUrl,
} from "./feed-sanitizer";
import { NEWS_BOT_USER_AGENT, guardNewsRequest } from "./robots";

const RANKING_ITEM_SELECTORS = [
  ".ranking_list li",
  ".list_newsissue li",
  ".rankingnews_list li",
  ".news-rank li",
  ".newsRanking li",
  "ol li",
] as const;

const SOURCE_SELECTOR_OVERRIDES: Partial<Record<string, readonly string[]>> = {
  sina_news_ranking: ["#Con11 td.ConsTi a", "td.ConsTi a"],
  sohu_news_ranking: ["a[href*='/a/']"],
  "163_news_ranking": ["div.tabContents.active td a", "div.tabContents td a"],
};

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

function sourceById(sourceId: string): Source {
  const source = SOURCES.find((item) => item.id === sourceId);
  if (!source || source.type !== "news") {
    throw new Error(`news source not found: ${sourceId}`);
  }
  return source;
}

function stableHash(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

function parseRank(input: string, fallbackRank: number): number {
  const direct = extractNumericCount(input);
  if (!direct) {
    return fallbackRank;
  }
  return Math.max(1, Math.min(200, direct));
}

function isLikelyNoiseTitle(title: string): boolean {
  return NON_ARTICLE_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function resolveCandidateUrl(url: string | null | undefined, baseUrl: string): string | undefined {
  const sanitized = sanitizeNewsUrl(url);
  if (!sanitized || sanitized.startsWith("javascript:") || sanitized.startsWith("#")) {
    return undefined;
  }

  try {
    return new URL(sanitized, baseUrl).toString();
  } catch {
    return sanitized;
  }
}

export class BaseRankingNewsScraper extends BaseScraper {
  readonly sourceId: string;
  readonly source: Source;

  constructor(sourceId: string) {
    super();
    this.sourceId = sourceId;
    this.source = sourceById(sourceId);
  }

  async fetchAndParse(): Promise<ScrapedPost[]> {
    await guardNewsRequest(this.source.scrapeUrl, this.source.trustTier);

    const response = await fetchWithRetry<string>(this.source.scrapeUrl, {
      responseType: "text",
      headers: {
        "User-Agent": NEWS_BOT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      timeout: 20_000,
    });

    const { load } = await import("cheerio");
    const $ = load(response.data);
    const posts: ScrapedPost[] = [];
    const seen = new Set<string>();

    const selectedNodes = (() => {
      for (const selector of SOURCE_SELECTOR_OVERRIDES[this.sourceId] ?? []) {
        const nodes = $(selector);
        if (nodes.length >= 5) {
          return nodes;
        }
      }
      for (const selector of RANKING_ITEM_SELECTORS) {
        const nodes = $(selector);
        if (nodes.length >= 5) {
          return nodes;
        }
      }
      return $("a");
    })();

    selectedNodes.each((index, element) => {
      if (posts.length >= 40) {
        return false;
      }

      const node = $(element);
      const contextNode = node.is("a") ? node.closest("tr") : node;
      const context = contextNode.length > 0 ? contextNode : node;
      const anchor = node.is("a") ? node : node.find("a").first();
      const rawTitle = sanitizeNewsTitle(anchor.text() || context.text());
      if (!rawTitle || rawTitle.length < 4 || isLikelyNoiseTitle(rawTitle)) {
        return;
      }

      const href = resolveCandidateUrl(anchor.attr("href"), this.source.scrapeUrl);
      if (!href) {
        return;
      }
      const externalId = stableHash(`${this.sourceId}:${href ?? rawTitle}:${index}`);
      if (seen.has(externalId)) {
        return;
      }
      seen.add(externalId);

      const rankText = context.find(".rank,.ranking_num,.num,.red span,.gray span").first().text();
      const rank = parseRank(rankText, index + 1);
      const viewCountText = context.find(".count,.view,.hits,.num,.cBlue").last().text() || context.text();
      const viewCount = extractNumericCount(viewCountText);
      const publishedText =
        context.find("time").attr("datetime") ||
        context.find("time").text() ||
        context.find(".date,.time").first().text();

      posts.push({
        externalId,
        title: rawTitle,
        bodyPreview: sanitizeNewsBodyPreview(context.text(), 280),
        url: href,
        postedAt: normalizePublishedAt(publishedText),
        rank,
        viewCount,
      });
    });

    if (posts.length === 0) {
      throw new Error(`no ranking entries parsed from ${this.source.scrapeUrl}`);
    }

    return posts;
  }
}
