import type { GlobalTopic } from "@global-pulse/shared";

interface GlobalTopicHistoryPoint {
  nameEn: string;
  nameKo: string;
  totalHeatScore: number;
  regionalHeatScores: Record<string, number>;
  createdAt: string;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
}

function topicKey(topic: Pick<GlobalTopic, "nameEn" | "nameKo">): string {
  return normalizeKey(topic.nameEn || topic.nameKo);
}

function toMs(value: string | undefined): number {
  if (!value) {
    return Number.NaN;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function findClosestBefore(history: GlobalTopicHistoryPoint[], targetMs: number): GlobalTopicHistoryPoint | null {
  const candidates = history
    .filter((point) => {
      const ms = toMs(point.createdAt);
      return Number.isFinite(ms) && ms <= targetMs;
    })
    .sort((left, right) => toMs(right.createdAt) - toMs(left.createdAt));

  return candidates[0] ?? null;
}

function buildPropagationEdges(
  timeline: NonNullable<GlobalTopic["propagationTimeline"]>,
): NonNullable<GlobalTopic["propagationEdges"]> {
  const edges: NonNullable<GlobalTopic["propagationEdges"]> = [];
  if (timeline.length < 2) {
    return edges;
  }

  for (let index = 0; index < timeline.length - 1; index += 1) {
    const from = timeline[index];
    const to = timeline[index + 1];
    if (!from || !to) {
      continue;
    }

    const lagMinutes = Math.max(0, Math.round((toMs(to.firstPostAt) - toMs(from.firstPostAt)) / 60000));
    if (!Number.isFinite(lagMinutes) || lagMinutes < 0) {
      continue;
    }

    const confidence = Math.max(0, 1 - Math.min(lagMinutes / 1440, 1));
    edges.push({
      from: from.regionId,
      to: to.regionId,
      lagMinutes,
      confidence: Number(confidence.toFixed(4)),
    });
  }

  return edges;
}

function regionStatus(
  regionId: string,
  currentHeat: number,
  history: GlobalTopicHistoryPoint[],
  nowMs: number,
): "fading" | "steady" | "accelerating" {
  const lookbackStart = nowMs - 24 * 60 * 60 * 1000;
  const history24h = history.filter((point) => {
    const pointMs = toMs(point.createdAt);
    return Number.isFinite(pointMs) && pointMs >= lookbackStart && pointMs <= nowMs;
  });

  const previousMax = history24h.reduce((max, point) => {
    const heat = Number(point.regionalHeatScores?.[regionId] ?? 0);
    return Math.max(max, Number.isFinite(heat) ? heat : 0);
  }, 0);

  const max24h = Math.max(currentHeat, previousMax);
  if (max24h > 0 && currentHeat / max24h < 0.3) {
    return "fading";
  }

  const previousPoint = findClosestBefore(history, nowMs - 60 * 60 * 1000);
  const previousHeat = Number(previousPoint?.regionalHeatScores?.[regionId] ?? 0);
  const velocity = currentHeat - (Number.isFinite(previousHeat) ? previousHeat : 0);
  const reachedNewPeak = currentHeat >= previousMax && currentHeat > 0;

  if (velocity > 0 && reachedNewPeak) {
    return "accelerating";
  }

  return "steady";
}

function enrichTimelineStatus(
  topic: GlobalTopic,
  history: GlobalTopicHistoryPoint[],
  nowMs: number,
): NonNullable<GlobalTopic["propagationTimeline"]> {
  const timeline = topic.propagationTimeline ?? [];
  return timeline.map((item) => {
    const currentHeat = Number(topic.regionalHeatScores[item.regionId] ?? item.heatAtDiscovery ?? 0);
    return {
      ...item,
      status: regionStatus(item.regionId, currentHeat, history, nowMs),
    };
  });
}

interface TopicMetricIntermediate {
  topic: GlobalTopic;
  velocity: number;
  acceleration: number;
  timeline: NonNullable<GlobalTopic["propagationTimeline"]>;
  edges: NonNullable<GlobalTopic["propagationEdges"]>;
}

export function applyPropagationMetrics(
  topics: GlobalTopic[],
  historyPoints: GlobalTopicHistoryPoint[],
  nowIso = new Date().toISOString(),
): GlobalTopic[] {
  if (topics.length === 0) {
    return [];
  }

  const nowMs = toMs(nowIso);
  const historyByKey = new Map<string, GlobalTopicHistoryPoint[]>();
  for (const point of historyPoints) {
    const key = topicKey(point);
    const bucket = historyByKey.get(key) ?? [];
    bucket.push(point);
    historyByKey.set(key, bucket);
  }

  for (const [key, points] of historyByKey.entries()) {
    historyByKey.set(
      key,
      [...points].sort((left, right) => toMs(left.createdAt) - toMs(right.createdAt)),
    );
  }

  const intermediates: TopicMetricIntermediate[] = topics.map((topic) => {
    const key = topicKey(topic);
    const history = historyByKey.get(key) ?? [];
    const point1h = findClosestBefore(history, nowMs - 60 * 60 * 1000);
    const point2h = findClosestBefore(history, nowMs - 2 * 60 * 60 * 1000);
    const prev1hScore = Number(point1h?.totalHeatScore ?? 0);
    const prev2hScore = Number(point2h?.totalHeatScore ?? 0);
    const velocity = Number((topic.totalHeatScore - prev1hScore).toFixed(4));
    const prevVelocity = prev1hScore - prev2hScore;
    const acceleration = Number((velocity - prevVelocity).toFixed(4));
    const timeline = enrichTimelineStatus(topic, history, nowMs);
    const edges = buildPropagationEdges(timeline);

    return {
      topic,
      velocity,
      acceleration,
      timeline,
      edges,
    };
  });

  const maxVelocity = Math.max(
    1,
    ...intermediates.map((entry) => (Number.isFinite(entry.velocity) ? Math.max(entry.velocity, 0) : 0)),
  );

  return intermediates.map((entry) => {
    const spreadScore = Number(
      (
        entry.topic.regions.length *
        (1 + Math.max(entry.velocity, 0) / maxVelocity)
      ).toFixed(4),
    );

    return {
      ...entry.topic,
      velocityPerHour: entry.velocity,
      acceleration: entry.acceleration,
      spreadScore,
      propagationTimeline: entry.timeline,
      propagationEdges: entry.edges,
    };
  });
}

export type { GlobalTopicHistoryPoint };
