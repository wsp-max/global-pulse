import type { GlobalTopic, Topic } from "@global-pulse/shared";

interface MapperOptions {
  similarityThreshold?: number;
  minRegions?: number;
}

interface TopicNode {
  topic: Topic;
  normalizedName: string;
  primaryNameToken: string | null;
  nameTokens: Set<string>;
  keywordTokens: Set<string>;
  tokens: Set<string>;
}

interface SimilarityMetrics {
  tokenJaccard: number;
  keywordJaccard: number;
  nameDice: number;
  sharedTokens: number;
  hasExactKeywordPhrase: boolean;
  hasStrongNameContainment: boolean;
  hasPrimaryNameTokenMatch: boolean;
  score: number;
}

const GENERIC_STOPWORDS = new Set([
  "news",
  "issue",
  "topic",
  "update",
  "official",
  "breaking",
  "video",
  "shorts",
  "reddit",
  "youtube",
  "today",
  "latest",
  "summary",
  "report",
  "analysis",
  "discussion",
  "reaction",
  "관련",
  "이슈",
  "논란",
  "반응",
  "현황",
  "요약",
  "速報",
  "まとめ",
  "热搜",
  "话题",
  "新闻",
]);

const DIGIT_ONLY_REGEX = /^\d+$/;

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function splitIntoScriptSegments(value: string): string[] {
  return (
    value.match(
      /[\p{Script=Hangul}]+|[\p{Script=Han}]+|[\p{Script=Hiragana}]+|[\p{Script=Katakana}]+|[a-z0-9][a-z0-9._-]*/giu,
    ) ?? []
  );
}

function shouldKeepToken(token: string): boolean {
  if (!token) {
    return false;
  }

  if (DIGIT_ONLY_REGEX.test(token)) {
    return false;
  }

  if (token.length < 2 || token.length > 48) {
    return false;
  }

  if (GENERIC_STOPWORDS.has(token)) {
    return false;
  }

  return true;
}

function tokenizeText(input: string): string[] {
  const rawTokens = input
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[\s/|,_\-:()[\]{}"'.!?]+/g);

  const tokens: string[] = [];
  for (const rawToken of rawTokens) {
    if (!rawToken) {
      continue;
    }

    for (const segment of splitIntoScriptSegments(rawToken)) {
      const normalized = normalizeToken(segment);
      if (!shouldKeepToken(normalized)) {
        continue;
      }
      tokens.push(normalized);
    }
  }

  return tokens;
}

function buildTokenSet(values: string[]): Set<string> {
  return new Set(values.filter((value) => shouldKeepToken(value)));
}

function setIntersectionCount(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  return intersection;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 0;
  }

  const intersection = setIntersectionCount(a, b);
  const union = a.size + b.size - intersection;
  if (union <= 0) {
    return 0;
  }
  return intersection / union;
}

function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  const intersection = setIntersectionCount(a, b);
  return (2 * intersection) / (a.size + b.size);
}

function toNode(topic: Topic): TopicNode {
  const normalizedName = normalizeToken(`${topic.nameEn} ${topic.nameKo}`.replace(/\s+/g, " "));
  const englishNameTokens = tokenizeText(topic.nameEn);
  const nameTokens = buildTokenSet([...englishNameTokens, ...tokenizeText(topic.nameKo)]);
  const primaryNameToken = englishNameTokens.find((token) => token.length >= 4) ?? null;

  const keywordTokens = new Set<string>();
  const keywordPhraseTokens = new Set<string>();
  for (const keyword of topic.keywords) {
    const normalizedKeyword = normalizeToken(keyword);
    if (normalizedKeyword && shouldKeepToken(normalizedKeyword)) {
      keywordPhraseTokens.add(normalizedKeyword);
    }

    for (const token of tokenizeText(keyword)) {
      keywordTokens.add(token);
    }
  }

  const tokens = new Set<string>([...nameTokens, ...keywordTokens, ...keywordPhraseTokens]);

  return {
    topic,
    normalizedName,
    primaryNameToken,
    nameTokens,
    keywordTokens: new Set([...keywordTokens, ...keywordPhraseTokens]),
    tokens,
  };
}

function computeSimilarity(a: TopicNode, b: TopicNode): SimilarityMetrics {
  const tokenJaccard = jaccard(a.tokens, b.tokens);
  const keywordJaccard = jaccard(a.keywordTokens, b.keywordTokens);
  const nameDice = diceCoefficient(a.nameTokens, b.nameTokens);
  const sharedTokens = setIntersectionCount(a.tokens, b.tokens);

  const hasStrongNameContainment =
    a.normalizedName.length >= 6 &&
    b.normalizedName.length >= 6 &&
    (a.normalizedName.includes(b.normalizedName) || b.normalizedName.includes(a.normalizedName));
  const hasPrimaryNameTokenMatch =
    Boolean(a.primaryNameToken) &&
    Boolean(b.primaryNameToken) &&
    a.primaryNameToken === b.primaryNameToken;

  let hasExactKeywordPhrase = false;
  for (const token of a.keywordTokens) {
    if (token.includes(" ") && b.keywordTokens.has(token)) {
      hasExactKeywordPhrase = true;
      break;
    }
  }

  let score = tokenJaccard * 0.45 + keywordJaccard * 0.35 + nameDice * 0.2;
  if (hasStrongNameContainment) {
    score += 0.2;
  }
  if (hasPrimaryNameTokenMatch) {
    score += 0.18;
  }
  if (hasExactKeywordPhrase) {
    score += 0.15;
  }

  if (
    sharedTokens < 2 &&
    !hasExactKeywordPhrase &&
    !hasStrongNameContainment &&
    !hasPrimaryNameTokenMatch
  ) {
    score *= 0.4;
  }

  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  return {
    tokenJaccard,
    keywordJaccard,
    nameDice,
    sharedTokens,
    hasExactKeywordPhrase,
    hasStrongNameContainment,
    hasPrimaryNameTokenMatch,
    score,
  };
}

function areTopicsSimilar(a: TopicNode, b: TopicNode, threshold: number): boolean {
  if (a.topic.regionId === b.topic.regionId) {
    return false;
  }

  const metrics = computeSimilarity(a, b);

  if (metrics.hasStrongNameContainment && metrics.score >= Math.max(0.22, threshold * 0.75)) {
    return true;
  }

  if (metrics.hasPrimaryNameTokenMatch && metrics.score >= Math.max(0.2, threshold * 0.65)) {
    return true;
  }

  if (
    metrics.hasExactKeywordPhrase &&
    (metrics.keywordJaccard >= 0.16 || metrics.tokenJaccard >= 0.2) &&
    metrics.score >= Math.max(0.2, threshold * 0.75)
  ) {
    return true;
  }

  if (
    metrics.sharedTokens < 2 &&
    !metrics.hasExactKeywordPhrase &&
    metrics.nameDice < 0.42 &&
    !metrics.hasStrongNameContainment &&
    !metrics.hasPrimaryNameTokenMatch
  ) {
    return false;
  }

  return metrics.score >= threshold;
}

function buildAdjacency(nodes: TopicNode[], threshold: number): number[][] {
  const adjacency = Array.from({ length: nodes.length }, () => [] as number[]);

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (areTopicsSimilar(nodes[i]!, nodes[j]!, threshold)) {
        adjacency[i]!.push(j);
        adjacency[j]!.push(i);
      }
    }
  }

  return adjacency;
}

function collectComponents(nodes: TopicNode[], adjacency: number[][]): TopicNode[][] {
  const visited = new Set<number>();
  const components: TopicNode[][] = [];

  for (let start = 0; start < nodes.length; start += 1) {
    if (visited.has(start)) {
      continue;
    }

    const queue = [start];
    visited.add(start);
    const component: TopicNode[] = [];

    while (queue.length > 0) {
      const idx = queue.shift()!;
      component.push(nodes[idx]!);

      for (const next of adjacency[idx]!) {
        if (visited.has(next)) {
          continue;
        }
        visited.add(next);
        queue.push(next);
      }
    }

    components.push(component);
  }

  return components;
}

function parseIsoDate(input: string): Date {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }
  return parsed;
}

function aggregateComponent(component: TopicNode[]): GlobalTopic | null {
  const topics = component.map((node) => node.topic);
  const regionIds = [...new Set(topics.map((topic) => topic.regionId))];
  if (regionIds.length < 2) {
    return null;
  }

  const representative = [...topics].sort((a, b) => b.heatScore - a.heatScore)[0]!;
  const topicIds = topics
    .filter((topic): topic is Topic & { id: number } => typeof topic.id === "number")
    .map((topic) => topic.id);

  const regionalHeatScores: Record<string, number> = {};
  const regionalSentiments: Record<string, number> = {};

  for (const regionId of regionIds) {
    const regionTopics = topics.filter((topic) => topic.regionId === regionId);
    const totalHeat = regionTopics.reduce((sum, topic) => sum + topic.heatScore, 0);
    const avgSentiment =
      regionTopics.reduce((sum, topic) => sum + topic.sentiment, 0) /
      Math.max(regionTopics.length, 1);

    regionalHeatScores[regionId] = Number(totalHeat.toFixed(3));
    regionalSentiments[regionId] = Number(avgSentiment.toFixed(3));
  }

  const earliest = [...topics].sort(
    (a, b) => parseIsoDate(a.periodStart).getTime() - parseIsoDate(b.periodStart).getTime(),
  )[0]!;

  const totalHeatScore = Object.values(regionalHeatScores).reduce((sum, value) => sum + value, 0);

  return {
    nameEn: representative.nameEn,
    nameKo: representative.nameKo,
    summaryEn: representative.summaryEn,
    summaryKo: representative.summaryKo,
    regions: regionIds,
    regionalSentiments,
    regionalHeatScores,
    topicIds,
    totalHeatScore: Number(totalHeatScore.toFixed(3)),
    firstSeenRegion: earliest.regionId,
    firstSeenAt: earliest.periodStart,
  };
}

export function mapCrossRegionTopics(
  topics: Topic[],
  options: MapperOptions = {},
): GlobalTopic[] {
  if (topics.length === 0) {
    return [];
  }

  const similarityThreshold = options.similarityThreshold ?? 0.32;
  const minRegions = options.minRegions ?? 2;

  const nodes: TopicNode[] = topics.map((topic) => toNode(topic));
  const adjacency = buildAdjacency(nodes, similarityThreshold);
  const components = collectComponents(nodes, adjacency);

  return components
    .map(aggregateComponent)
    .filter((item): item is GlobalTopic => Boolean(item))
    .filter((topic) => topic.regions.length >= minRegions)
    .sort((a, b) => b.totalHeatScore - a.totalHeatScore);
}

export function debugCrossRegionSimilarity(a: Topic, b: Topic): SimilarityMetrics {
  return computeSimilarity(toNode(a), toNode(b));
}
