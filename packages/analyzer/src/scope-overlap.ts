import { isLowInfoTopicName, normalizeTopicNameValue, type Topic } from "@global-pulse/shared";

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
  autoCosineThreshold?: number;
  tieMinutes?: number;
}

interface CandidateOverlap extends ScopeOverlapRow {
  score: number;
}

interface TopicEvidence {
  canonical: string | null;
  embedding: number[] | null;
  tokens: Set<string>;
  nameTokens: Set<string>;
  keywordTokens: Set<string>;
  entityTokens: Set<string>;
  keywordPhrases: Set<string>;
}

interface LexicalMetrics {
  sharedTokens: number;
  nameSharedTokens: number;
  keywordJaccard: number;
  entitySharedTokens: number;
  hasExactKeywordPhrase: boolean;
  score: number;
  hasEvidence: boolean;
}

const NON_WORD_REGEX = /[\p{P}\p{S}\s]+/gu;
const PLACEHOLDER_CANONICAL_REGEX = /^(globaltopic|topic|regiontopic|regionaltopic)\d*$/i;
const URL_LIKE_REGEX = /(https?:\/\/|www\.|\/r\/|submitted by|please read)/i;
const GENERIC_TOKENS = new Set([
  "news",
  "topic",
  "issue",
  "update",
  "updates",
  "latest",
  "breaking",
  "community",
  "reddit",
  "video",
  "photo",
  "post",
  "posts",
  "thread",
  "article",
  "provided",
  "keywords",
  "current",
]);

function normalizeCanonicalKey(value: string | null | undefined): string | null {
  const normalized = normalizeTopicNameValue(value);
  if (!normalized || URL_LIKE_REGEX.test(normalized)) {
    return null;
  }

  const collapsed = normalized
    .normalize("NFKC")
    .toLowerCase()
    .replace(NON_WORD_REGEX, "")
    .trim();

  if (
    !collapsed ||
    collapsed.length < 5 ||
    PLACEHOLDER_CANONICAL_REGEX.test(collapsed) ||
    (isLowInfoTopicName(normalized, "ko") && isLowInfoTopicName(normalized, "en"))
  ) {
    return null;
  }

  return collapsed;
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

function normalizeToken(value: string | null | undefined): string {
  return normalizeTopicNameValue(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldKeepToken(value: string): boolean {
  if (!value || GENERIC_TOKENS.has(value)) {
    return false;
  }
  if (/^\d+$/.test(value)) {
    return false;
  }
  if (/^[a-z0-9]+$/i.test(value)) {
    return value.length >= 3;
  }
  return value.length >= 2;
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeToken(value).split(" ").filter(shouldKeepToken);
}

function addTokens(target: Set<string>, values: Array<string | null | undefined>): void {
  for (const value of values) {
    for (const token of tokenize(value)) {
      target.add(token);
    }
  }
}

function buildTopicEvidence(topic: ScopeOverlapCandidate): TopicEvidence {
  const nameTokens = new Set<string>();
  const keywordTokens = new Set<string>();
  const entityTokens = new Set<string>();
  const keywordPhrases = new Set<string>();
  const canonical = normalizeCanonicalKey(topic.canonicalKey ?? topic.nameEn);

  addTokens(nameTokens, [topic.nameKo, topic.nameEn, topic.summaryKo, topic.summaryEn]);
  if (canonical) {
    addTokens(nameTokens, [topic.canonicalKey ?? topic.nameEn]);
  }

  for (const keyword of topic.keywords ?? []) {
    const normalizedKeyword = normalizeToken(keyword);
    if (normalizedKeyword && normalizedKeyword.includes(" ")) {
      keywordPhrases.add(normalizedKeyword);
    }
    addTokens(keywordTokens, [keyword]);
  }

  for (const entity of topic.entities ?? []) {
    addTokens(entityTokens, [entity.text]);
  }

  addTokens(nameTokens, topic.aliases ?? []);
  addTokens(keywordTokens, topic.sampleTitles ?? []);

  return {
    canonical,
    embedding: toEmbeddingVector(topic.embeddingJson ?? null),
    tokens: new Set([...nameTokens, ...keywordTokens, ...entityTokens]),
    nameTokens,
    keywordTokens,
    entityTokens,
    keywordPhrases,
  };
}

function intersectionCount(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  const intersection = intersectionCount(left, right);
  const union = new Set([...left, ...right]).size;
  return union > 0 ? intersection / union : 0;
}

function computeLexicalMetrics(left: TopicEvidence, right: TopicEvidence): LexicalMetrics {
  const sharedTokens = intersectionCount(left.tokens, right.tokens);
  const nameSharedTokens = intersectionCount(left.nameTokens, right.nameTokens);
  const entitySharedTokens = intersectionCount(left.entityTokens, right.entityTokens);
  const keywordJaccard = jaccard(left.keywordTokens, right.keywordTokens);
  let hasExactKeywordPhrase = false;

  for (const phrase of left.keywordPhrases) {
    if (right.keywordPhrases.has(phrase)) {
      hasExactKeywordPhrase = true;
      break;
    }
  }

  const score = Math.min(
    1,
    sharedTokens * 0.08 +
      nameSharedTokens * 0.16 +
      entitySharedTokens * 0.18 +
      keywordJaccard * 0.42 +
      (hasExactKeywordPhrase ? 0.2 : 0),
  );

  return {
    sharedTokens,
    nameSharedTokens,
    keywordJaccard,
    entitySharedTokens,
    hasExactKeywordPhrase,
    score,
    hasEvidence:
      sharedTokens >= 2 ||
      nameSharedTokens >= 1 ||
      entitySharedTokens >= 1 ||
      keywordJaccard >= 0.18 ||
      hasExactKeywordPhrase,
  };
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
  const autoCosineThreshold = options.autoCosineThreshold ?? 0.9;
  const tieMinutes = options.tieMinutes ?? 10;

  const newsByRegion = new Map<string, Array<{ topic: ScopeOverlapCandidate; evidence: TopicEvidence }>>();
  for (const topic of newsTopics) {
    const regionItems = newsByRegion.get(topic.regionId) ?? [];
    regionItems.push({ topic, evidence: buildTopicEvidence(topic) });
    newsByRegion.set(topic.regionId, regionItems);
  }

  const candidates: CandidateOverlap[] = [];

  for (const communityTopic of communityTopics) {
    const communityTopicId = communityTopic.id ?? 0;
    if (communityTopicId <= 0) {
      continue;
    }

    const candidateNewsTopics = newsByRegion.get(communityTopic.regionId) ?? [];
    if (candidateNewsTopics.length === 0) {
      continue;
    }

    const communityEvidence = buildTopicEvidence(communityTopic);

    for (const { topic: newsTopic, evidence: newsEvidence } of candidateNewsTopics) {
      const newsTopicId = newsTopic.id ?? 0;
      if (newsTopicId <= 0) {
        continue;
      }

      const canonicalMatch =
        Boolean(communityEvidence.canonical) && communityEvidence.canonical === newsEvidence.canonical;
      const cosine = cosineSimilarity(communityEvidence.embedding, newsEvidence.embedding);
      const lexical = computeLexicalMetrics(communityEvidence, newsEvidence);
      const passesCanonicalMatch = canonicalMatch && (cosine >= 0.55 || lexical.hasEvidence);
      const passesStrongCosine = cosine >= autoCosineThreshold;
      const passesAssistedCosine = cosine >= cosineThreshold && lexical.hasEvidence;

      if (!passesCanonicalMatch && !passesStrongCosine && !passesAssistedCosine) {
        continue;
      }

      const lagMinutes = toMinutesDifference(communityTopic.firstPostAt, newsTopic.firstPostAt);
      candidates.push({
        communityTopicId,
        newsTopicId,
        canonicalKey: canonicalMatch ? communityEvidence.canonical : communityEvidence.canonical ?? newsEvidence.canonical,
        cosine: Number(cosine.toFixed(6)),
        lagMinutes,
        leader: resolveLeader(lagMinutes, tieMinutes),
        score: Number((cosine + lexical.score * 0.35 + (canonicalMatch ? 0.2 : 0)).toFixed(6)),
      });
    }
  }

  const usedCommunityTopicIds = new Set<number>();
  const usedNewsTopicIds = new Set<number>();
  const overlaps: ScopeOverlapRow[] = [];

  for (const candidate of candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (right.cosine !== left.cosine) {
      return right.cosine - left.cosine;
    }
    return Math.abs(left.lagMinutes) - Math.abs(right.lagMinutes);
  })) {
    if (usedCommunityTopicIds.has(candidate.communityTopicId) || usedNewsTopicIds.has(candidate.newsTopicId)) {
      continue;
    }

    usedCommunityTopicIds.add(candidate.communityTopicId);
    usedNewsTopicIds.add(candidate.newsTopicId);
    overlaps.push({
      communityTopicId: candidate.communityTopicId,
      newsTopicId: candidate.newsTopicId,
      canonicalKey: candidate.canonicalKey,
      cosine: candidate.cosine,
      lagMinutes: candidate.lagMinutes,
      leader: candidate.leader,
    });
  }

  return overlaps;
}
