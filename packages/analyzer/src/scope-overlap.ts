import type { Topic } from "@global-pulse/shared";

export interface ScopeOverlapCandidate extends Topic {
  firstPostAt: string;
}

export interface ScopeOverlapRow {
  communityTopicId: number;
  newsTopicId: number;
  canonicalKey: string | null;
  cosine: number;
  lagMinutes: number;
  leader: "community" | "news" | "tie";
}

interface ScopeOverlapOptions {
  cosineThreshold?: number;
  tieMinutes?: number;
}

function normalizeCanonicalKey(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
}

function toEmbeddingVector(value: number[] | null | undefined): number[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const vector = value
    .map((item) => (typeof item === "number" && Number.isFinite(item) ? item : 0))
    .filter((item) => Number.isFinite(item));

  return vector.length > 0 ? vector : null;
}

function cosineSimilarity(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length === 0 || b.length === 0) {
    return 0;
  }

  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function toMinutesDifference(leftIso: string, rightIso: string): number {
  const left = new Date(leftIso).getTime();
  const right = new Date(rightIso).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return 0;
  }
  return Math.round((right - left) / 60000);
}

function resolveLeader(lagMinutes: number, tieMinutes: number): "community" | "news" | "tie" {
  if (Math.abs(lagMinutes) < tieMinutes) {
    return "tie";
  }
  return lagMinutes > 0 ? "community" : "news";
}

export function detectScopeOverlaps(
  communityTopics: ScopeOverlapCandidate[],
  newsTopics: ScopeOverlapCandidate[],
  options: ScopeOverlapOptions = {},
): ScopeOverlapRow[] {
  if (communityTopics.length === 0 || newsTopics.length === 0) {
    return [];
  }

  const cosineThreshold = options.cosineThreshold ?? 0.82;
  const tieMinutes = options.tieMinutes ?? 10;

  const newsByRegion = new Map<string, ScopeOverlapCandidate[]>();
  for (const topic of newsTopics) {
    const regionItems = newsByRegion.get(topic.regionId) ?? [];
    regionItems.push(topic);
    newsByRegion.set(topic.regionId, regionItems);
  }

  const overlaps: ScopeOverlapRow[] = [];

  for (const communityTopic of communityTopics) {
    const candidateNewsTopics = newsByRegion.get(communityTopic.regionId) ?? [];
    if (candidateNewsTopics.length === 0) {
      continue;
    }

    const communityCanonical = normalizeCanonicalKey(communityTopic.canonicalKey ?? communityTopic.nameEn);
    const communityEmbedding = toEmbeddingVector(communityTopic.embeddingJson ?? null);

    let best: ScopeOverlapRow | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const newsTopic of candidateNewsTopics) {
      const newsCanonical = normalizeCanonicalKey(newsTopic.canonicalKey ?? newsTopic.nameEn);
      const newsEmbedding = toEmbeddingVector(newsTopic.embeddingJson ?? null);
      const canonicalMatch = communityCanonical.length > 0 && communityCanonical === newsCanonical;
      const cosine = cosineSimilarity(communityEmbedding, newsEmbedding);

      if (!canonicalMatch && cosine < cosineThreshold) {
        continue;
      }

      const lagMinutes = toMinutesDifference(communityTopic.firstPostAt, newsTopic.firstPostAt);
      const overlap: ScopeOverlapRow = {
        communityTopicId: communityTopic.id ?? 0,
        newsTopicId: newsTopic.id ?? 0,
        canonicalKey: canonicalMatch
          ? communityCanonical || newsCanonical || null
          : communityCanonical || newsCanonical || null,
        cosine: Number(cosine.toFixed(6)),
        lagMinutes,
        leader: resolveLeader(lagMinutes, tieMinutes),
      };

      const score = canonicalMatch ? 10 + cosine : cosine;
      if (score > bestScore) {
        bestScore = score;
        best = overlap;
      }
    }

    if (best && best.communityTopicId > 0 && best.newsTopicId > 0) {
      overlaps.push(best);
    }
  }

  const dedup = new Map<string, ScopeOverlapRow>();
  for (const overlap of overlaps) {
    const key = `${overlap.communityTopicId}:${overlap.newsTopicId}`;
    const current = dedup.get(key);
    if (!current || overlap.cosine > current.cosine) {
      dedup.set(key, overlap);
    }
  }

  return [...dedup.values()];
}
