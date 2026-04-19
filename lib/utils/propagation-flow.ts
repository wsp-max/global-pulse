import type { GlobalTopic } from "@global-pulse/shared";

export type FlowVariant = "community" | "news";

interface PropagationEdgeLike {
  from: string;
  to: string;
  lagMinutes: number;
  confidence: number;
}

export interface AggregatedFlowEdge {
  from: string;
  to: string;
  lagMinutes: number;
  confidence: number;
  volumeHeatSum: number;
  edgeCount: number;
  velocity: number;
  spreadScore: number;
}

interface DirectedAccumulator {
  from: string;
  to: string;
  confidenceWeightedLag: number;
  confidenceWeight: number;
  confidenceSum: number;
  edgeCount: number;
  volumeHeatSum: number;
  velocity: number;
  spreadScore: number;
}

interface AggregateFlowEdgesOptions {
  limit?: number;
  maxTopics?: number;
  isValidRegion?: (regionId: string) => boolean;
}

const COMMUNITY_FLOW_COLORS = ["#67E8F9", "#22D3EE", "#06B6D4", "#0891B2", "#0E7490"] as const;
const NEWS_FLOW_COLORS = ["#FDE68A", "#FCD34D", "#F59E0B", "#EA580C", "#C2410C"] as const;

function toFiniteNumber(value: unknown, fallback = 0): number {
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

function clampConfidence(value: unknown): number {
  return Math.max(0, Math.min(1, toFiniteNumber(value, 0)));
}

function normalizeLagMinutes(value: unknown): number {
  return Math.max(1, Math.round(Math.abs(toFiniteNumber(value, 0))));
}

function edgeChoiceComparator(left: AggregatedFlowEdge, right: AggregatedFlowEdge): number {
  if (right.volumeHeatSum !== left.volumeHeatSum) {
    return right.volumeHeatSum - left.volumeHeatSum;
  }

  if (left.lagMinutes !== right.lagMinutes) {
    return left.lagMinutes - right.lagMinutes;
  }

  const leftKey = `${left.from}:${left.to}`;
  const rightKey = `${right.from}:${right.to}`;
  return leftKey.localeCompare(rightKey);
}

export function toVolumeBand(volumeHeatSum: number, maxVolumeHeatSum: number): number {
  const safeVolume = Math.max(0, toFiniteNumber(volumeHeatSum, 0));
  const safeMax = Math.max(1, toFiniteNumber(maxVolumeHeatSum, 1));
  const band = Math.log10(1 + safeVolume) / Math.log10(1 + safeMax);
  return Number.isFinite(band) ? Math.max(0, Math.min(1, band)) : 0;
}

export function getFlowStrokeColor(variant: FlowVariant, volumeBand: number): string {
  const palette = variant === "news" ? NEWS_FLOW_COLORS : COMMUNITY_FLOW_COLORS;
  const clampedBand = Math.max(0, Math.min(1, volumeBand));
  const index = Math.min(palette.length - 1, Math.floor(clampedBand * palette.length));
  return palette[index] ?? palette[0];
}

export function aggregateFlowEdges(
  topics: GlobalTopic[],
  options: AggregateFlowEdgesOptions = {},
): AggregatedFlowEdge[] {
  const directed = new Map<string, DirectedAccumulator>();
  const maxTopics = Math.max(1, options.maxTopics ?? 64);

  for (const topic of topics.slice(0, maxTopics)) {
    const heatScore = Math.max(0, toFiniteNumber(topic.totalHeatScore, 0));
    const velocity = Math.max(0, toFiniteNumber(topic.velocityPerHour, 0));
    const spreadScore = Math.max(0, toFiniteNumber(topic.spreadScore, 0));
    const edges = Array.isArray(topic.propagationEdges) ? topic.propagationEdges : [];

    for (const edge of edges as PropagationEdgeLike[]) {
      if (!edge?.from || !edge?.to || edge.from === edge.to) {
        continue;
      }
      if (options.isValidRegion && (!options.isValidRegion(edge.from) || !options.isValidRegion(edge.to))) {
        continue;
      }

      const confidence = clampConfidence(edge.confidence);
      const lagMinutes = normalizeLagMinutes(edge.lagMinutes);
      const key = `${edge.from}:${edge.to}`;
      const existing = directed.get(key);

      if (!existing) {
        directed.set(key, {
          from: edge.from,
          to: edge.to,
          confidenceWeightedLag: lagMinutes * Math.max(confidence, 0.05),
          confidenceWeight: Math.max(confidence, 0.05),
          confidenceSum: confidence,
          edgeCount: 1,
          volumeHeatSum: heatScore * confidence,
          velocity,
          spreadScore,
        });
        continue;
      }

      const lagWeight = Math.max(confidence, 0.05);
      existing.confidenceWeightedLag += lagMinutes * lagWeight;
      existing.confidenceWeight += lagWeight;
      existing.confidenceSum += confidence;
      existing.edgeCount += 1;
      existing.volumeHeatSum += heatScore * confidence;
      existing.velocity = Math.max(existing.velocity, velocity);
      existing.spreadScore = Math.max(existing.spreadScore, spreadScore);
    }
  }

  const resolvedDirected: AggregatedFlowEdge[] = [];
  for (const acc of directed.values()) {
    resolvedDirected.push({
      from: acc.from,
      to: acc.to,
      lagMinutes: Math.max(1, Math.round(acc.confidenceWeightedLag / Math.max(acc.confidenceWeight, 0.05))),
      confidence: Math.max(0, Math.min(1, acc.confidenceSum / acc.edgeCount)),
      volumeHeatSum: Number(acc.volumeHeatSum.toFixed(4)),
      edgeCount: acc.edgeCount,
      velocity: acc.velocity,
      spreadScore: acc.spreadScore,
    });
  }

  const pairBuckets = new Map<string, AggregatedFlowEdge[]>();
  for (const edge of resolvedDirected) {
    const pairKey = [edge.from, edge.to].sort().join("|");
    const list = pairBuckets.get(pairKey);
    if (!list) {
      pairBuckets.set(pairKey, [edge]);
      continue;
    }
    list.push(edge);
  }

  const reciprocalResolved: AggregatedFlowEdge[] = [];
  for (const bucket of pairBuckets.values()) {
    bucket.sort(edgeChoiceComparator);
    reciprocalResolved.push(bucket[0]!);
  }

  const limit = Math.max(1, options.limit ?? 20);
  return reciprocalResolved.sort(edgeChoiceComparator).slice(0, limit);
}
