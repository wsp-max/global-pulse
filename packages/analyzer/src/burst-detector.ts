import { sanitizePostTitle, tokenizeForAnalysis, type AnalysisPostInput } from "./keyword-extractor";

export interface BurstKeywordScore {
  keyword: string;
  zScore: number;
  burstBoost: number;
  recentCount: number;
  baselineMean: number;
  baselineStd: number;
}

interface BurstOptions {
  endAtIso?: string;
  minZ?: number;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const DEFAULT_MIN_Z = Number(process.env.ANALYZER_BURST_MIN_Z ?? 2.0);

function toTimestamp(post: AnalysisPostInput): number | null {
  const candidate = post.postedAt ?? post.collectedAt;
  if (!candidate) {
    return null;
  }
  const parsed = new Date(candidate).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeKey(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function calcMean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calcStd(values: number[], mean: number): number {
  if (values.length === 0) {
    return 0;
  }
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function splitKeywordTerms(keyword: string): string[] {
  return keyword
    .normalize("NFKC")
    .toLowerCase()
    .split(/\s+/g)
    .map((term) => term.trim())
    .filter(Boolean);
}

function buildKeywordMatchers(keywords: string[]): Array<{ key: string; terms: string[] }> {
  return [...new Set(keywords.map((keyword) => normalizeKey(keyword)).filter(Boolean))]
    .map((key) => ({
      key,
      terms: splitKeywordTerms(key),
    }))
    .filter((item) => item.terms.length > 0);
}

export function detectKeywordBursts(
  regionId: string,
  posts: AnalysisPostInput[],
  keywords: string[],
  options: BurstOptions = {},
): Map<string, BurstKeywordScore> {
  if (posts.length === 0 || keywords.length === 0) {
    return new Map();
  }

  const minZ = Number.isFinite(options.minZ ?? Number.NaN) ? Number(options.minZ) : DEFAULT_MIN_Z;
  const explicitEndTs = options.endAtIso ? new Date(options.endAtIso).getTime() : Number.NaN;
  const endTs = Number.isFinite(explicitEndTs)
    ? explicitEndTs
    : posts
        .map((post) => toTimestamp(post))
        .filter((value): value is number => value !== null)
        .reduce((max, value) => Math.max(max, value), Date.now());

  const recentStartTs = endTs - ONE_HOUR_MS;
  const baselineStartTs = endTs - ONE_HOUR_MS * 25;
  const matchers = buildKeywordMatchers(keywords);
  const baselineBuckets = new Map<string, number[]>();
  const recentCounts = new Map<string, number>();

  for (const matcher of matchers) {
    baselineBuckets.set(matcher.key, Array.from({ length: 24 }, () => 0));
    recentCounts.set(matcher.key, 0);
  }

  for (const post of posts) {
    const ts = toTimestamp(post);
    if (ts === null || ts < baselineStartTs || ts > endTs) {
      continue;
    }

    const sanitizedTitle = sanitizePostTitle(post.title, post.sourceId);
    const tokens = tokenizeForAnalysis(sanitizedTitle, regionId, post.sourceId);
    if (tokens.length === 0) {
      continue;
    }

    const tokenSet = new Set(tokens);

    for (const matcher of matchers) {
      const matched = matcher.terms.every((term) => tokenSet.has(term));
      if (!matched) {
        continue;
      }

      if (ts >= recentStartTs) {
        recentCounts.set(matcher.key, (recentCounts.get(matcher.key) ?? 0) + 1);
      } else {
        const bucketIndex = Math.floor((ts - baselineStartTs) / ONE_HOUR_MS);
        if (bucketIndex >= 0 && bucketIndex < 24) {
          const buckets = baselineBuckets.get(matcher.key);
          if (buckets) {
            buckets[bucketIndex] += 1;
          }
        }
      }
    }
  }

  const result = new Map<string, BurstKeywordScore>();

  for (const matcher of matchers) {
    const buckets = baselineBuckets.get(matcher.key) ?? [];
    const recentCount = recentCounts.get(matcher.key) ?? 0;
    const baselineMean = calcMean(buckets);
    const baselineStd = calcStd(buckets, baselineMean);
    const safeStd = Math.max(baselineStd, Math.sqrt(baselineMean + 1));
    const zScore = safeStd <= 0 ? 0 : (recentCount - baselineMean) / safeStd;

    if (zScore < minZ) {
      continue;
    }

    const burstBoost = 1 + Math.min(zScore / 4, 1.5);
    result.set(matcher.key, {
      keyword: matcher.key,
      zScore: Number(zScore.toFixed(4)),
      burstBoost: Number(burstBoost.toFixed(4)),
      recentCount,
      baselineMean: Number(baselineMean.toFixed(4)),
      baselineStd: Number(baselineStd.toFixed(4)),
    });
  }

  return result;
}
