import type { GlobalTopic, Topic } from "@global-pulse/shared";

interface MapperOptions {
  similarityThreshold?: number;
  minRegions?: number;
}

interface TopicNode {
  topic: Topic;
  tokens: Set<string>;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function toTokens(topic: Topic): Set<string> {
  const bag = new Set<string>();

  const nameTokens = `${topic.nameEn} ${topic.nameKo}`
    .split(/[\s/|,_\-:()[\]{}"'.!?]+/g)
    .map(normalizeToken)
    .filter((token) => token.length >= 2);

  for (const token of nameTokens) {
    bag.add(token);
  }

  for (const keyword of topic.keywords) {
    const normalized = normalizeToken(keyword);
    if (normalized.length >= 2) {
      bag.add(normalized);
    }
  }

  return bag;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  if (union <= 0) {
    return 0;
  }

  return intersection / union;
}

function areTopicsSimilar(a: TopicNode, b: TopicNode, threshold: number): boolean {
  if (a.topic.regionId === b.topic.regionId) {
    return false;
  }

  const nameA = normalizeToken(a.topic.nameEn);
  const nameB = normalizeToken(b.topic.nameEn);

  if (nameA && nameB && (nameA.includes(nameB) || nameB.includes(nameA))) {
    return true;
  }

  return jaccard(a.tokens, b.tokens) >= threshold;
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

  const similarityThreshold = options.similarityThreshold ?? 0.3;
  const minRegions = options.minRegions ?? 2;

  const nodes: TopicNode[] = topics.map((topic) => ({
    topic,
    tokens: toTokens(topic),
  }));

  const adjacency = buildAdjacency(nodes, similarityThreshold);
  const components = collectComponents(nodes, adjacency);

  return components
    .map(aggregateComponent)
    .filter((item): item is GlobalTopic => Boolean(item))
    .filter((topic) => topic.regions.length >= minRegions)
    .sort((a, b) => b.totalHeatScore - a.totalHeatScore);
}
