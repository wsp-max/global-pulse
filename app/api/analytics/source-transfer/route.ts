import { NextResponse } from "next/server";
import { getAllRegions } from "@global-pulse/shared";
import type {
  SourceTransferCandidatePairRow,
  SourceTransferCandidateSummary,
  SourceTransferDirection,
  SourceTransferPairRow,
  SourceTransferSummary,
} from "@/lib/types/api";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";

export const dynamic = "force-dynamic";

interface SummaryRow {
  total_events: number | string;
  unique_pairs: number | string;
  community_lead_count: number | string;
  news_lead_count: number | string;
  tie_count: number | string;
  median_lag_minutes: number | string | null;
  p90_lag_minutes: number | string | null;
  latest_detected_at: string | null;
}

interface PairRow {
  region_id: string;
  leader: "community" | "news" | "tie";
  community_topic_id: number | string;
  community_topic_name_ko: string | null;
  community_topic_name_en: string | null;
  news_topic_id: number | string;
  news_topic_name_ko: string | null;
  news_topic_name_en: string | null;
  event_count: number | string;
  first_detected_at: string;
  last_detected_at: string;
  avg_lag_minutes: number | string | null;
  latest_lag_minutes: number | string | null;
  avg_cosine: number | string | null;
  community_first_post_at: string | null;
  news_first_post_at: string | null;
}

interface TrendRow {
  bucket: string;
  event_count: number | string;
  avg_lag_minutes: number | string | null;
  community_lead_count: number | string;
  news_lead_count: number | string;
  tie_count: number | string;
}

interface LeadCountsRow {
  community_lead_count: number | string;
  news_lead_count: number | string;
}

interface TopicCandidateRow {
  id: number | string;
  region_id: string;
  scope: "community" | "news" | "mixed";
  name_ko: string | null;
  name_en: string | null;
  summary_ko: string | null;
  summary_en: string | null;
  sample_titles: string[] | null;
  keywords: string[] | null;
  entities: Array<{ text?: string | null; type?: string | null }> | null;
  aliases: string[] | null;
  canonical_key: string | null;
  heat_score: number | string | null;
  post_count: number | string | null;
  period_start: string;
}

interface CandidateEvidence {
  canonical: string | null;
  nameTokens: Set<string>;
  keywordTokens: Set<string>;
  keywordPhrases: Set<string>;
  entityTokens: Set<string>;
}

function toNumber(value: unknown, fallback = 0): number {
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

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDirection(value: string | null): SourceTransferDirection {
  if (value === "news_to_community" || value === "both") {
    return value;
  }
  return "community_to_news";
}

function parseHours(value: string | null): number {
  const parsed = Number(value ?? 24);
  if (!Number.isFinite(parsed)) {
    return 24;
  }
  return Math.max(1, Math.min(Math.trunc(parsed), 168));
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 30);
  if (!Number.isFinite(parsed)) {
    return 30;
  }
  return Math.max(1, Math.min(Math.trunc(parsed), 200));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.trunc(parsed));
}

function parseRegion(value: string | null): string {
  const raw = (value ?? "all").trim().toLowerCase();
  if (!raw || raw === "all") {
    return "all";
  }
  const regionIds = new Set(getAllRegions().map((region) => region.id));
  return regionIds.has(raw) ? raw : "all";
}

const PLACEHOLDER_CANONICAL_SQL_PATTERN =
  "^(globaltopic[0-9]*|topic[0-9]*|regiontopic[0-9]*|regionaltopic[0-9]*|region[a-z]{2,3}topic[0-9]+)$";
const NON_WORD_REGEX = /[\p{P}\p{S}\s]+/gu;
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
  "read",
  "source",
  "sources",
  "submitted",
  "login",
  "register",
  "diario",
  "consulta",
  "consultas",
  "click",
  "more",
]);

function buildCanonicalFilterSql(columnName: string): string {
  return `(
          ${columnName} is null
          or regexp_replace(lower(coalesce(${columnName}, '')), '[^a-z0-9]+', '', 'g')
            !~ '${PLACEHOLDER_CANONICAL_SQL_PATTERN}'
        )`;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCanonical(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized || /(https?:\/\/|www\.|\/r\/|submitted by|please read)/i.test(normalized)) {
    return null;
  }

  const collapsed = normalized.replace(NON_WORD_REGEX, "").trim();
  if (
    !collapsed ||
    collapsed.length < 5 ||
    new RegExp(PLACEHOLDER_CANONICAL_SQL_PATTERN, "i").test(collapsed)
  ) {
    return null;
  }
  return collapsed;
}

function shouldKeepToken(value: string): boolean {
  if (!value || GENERIC_TOKENS.has(value) || /^\d+$/.test(value)) {
    return false;
  }
  if (/^[a-z0-9]+$/i.test(value)) {
    return value.length >= 3;
  }
  return value.length >= 2;
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeText(value).split(" ").filter(shouldKeepToken);
}

function addTokens(target: Set<string>, values: Array<string | null | undefined>): void {
  for (const value of values) {
    for (const token of tokenize(value)) {
      target.add(token);
    }
  }
}

function intersection(left: Set<string>, right: Set<string>): string[] {
  const values: string[] = [];
  for (const value of left) {
    if (right.has(value)) {
      values.push(value);
    }
  }
  return values;
}

function topicTimestamp(row: TopicCandidateRow): string {
  return row.period_start;
}

function buildCandidateEvidence(row: TopicCandidateRow): CandidateEvidence {
  const nameTokens = new Set<string>();
  const keywordTokens = new Set<string>();
  const keywordPhrases = new Set<string>();
  const entityTokens = new Set<string>();
  const canonical = normalizeCanonical(row.canonical_key ?? row.name_en);

  addTokens(nameTokens, [row.name_ko, row.name_en, row.summary_ko, row.summary_en, ...(row.aliases ?? [])]);
  if (canonical) {
    addTokens(nameTokens, [row.canonical_key ?? row.name_en]);
  }

  for (const keyword of row.keywords ?? []) {
    addTokens(keywordTokens, [keyword]);
    const phrase = tokenize(keyword).join(" ");
    if (phrase && phrase.includes(" ")) {
      keywordPhrases.add(phrase);
    }
  }
  addTokens(keywordTokens, row.sample_titles ?? []);

  for (const entity of row.entities ?? []) {
    addTokens(entityTokens, [entity.text]);
  }

  return { canonical, nameTokens, keywordTokens, keywordPhrases, entityTokens };
}

function resolveLeader(lagMinutes: number): "community" | "news" | "tie" {
  if (Math.abs(lagMinutes) < 10) {
    return "tie";
  }
  return lagMinutes > 0 ? "community" : "news";
}

function directionAllowsLeader(direction: SourceTransferDirection, leader: "community" | "news" | "tie"): boolean {
  return (
    (direction === "community_to_news" && leader === "community") ||
    (direction === "news_to_community" && leader === "news") ||
    (direction === "both" && (leader === "community" || leader === "news" || leader === "tie"))
  );
}

function buildCandidatePairs(
  topicRows: TopicCandidateRow[],
  officialPairs: SourceTransferPairRow[],
  direction: SourceTransferDirection,
  limit: number,
): { pairs: SourceTransferCandidatePairRow[]; summary: SourceTransferCandidateSummary } {
  const communityRows = topicRows.filter((row) => row.scope === "community");
  const newsRowsByRegion = new Map<string, TopicCandidateRow[]>();
  for (const row of topicRows) {
    if (row.scope !== "news") {
      continue;
    }
    const items = newsRowsByRegion.get(row.region_id) ?? [];
    items.push(row);
    newsRowsByRegion.set(row.region_id, items);
  }

  const officialKeys = new Set(officialPairs.map((pair) => pair.pairKey));
  const candidates: SourceTransferCandidatePairRow[] = [];

  for (const community of communityRows) {
    const communityTopicId = toNumber(community.id);
    if (communityTopicId <= 0) {
      continue;
    }
    const communityEvidence = buildCandidateEvidence(community);
    const newsRows = newsRowsByRegion.get(community.region_id) ?? [];

    for (const news of newsRows) {
      const newsTopicId = toNumber(news.id);
      if (newsTopicId <= 0) {
        continue;
      }

      const pairKey = buildPairKey(community.region_id, communityTopicId, newsTopicId);
      if (officialKeys.has(pairKey)) {
        continue;
      }

      const newsEvidence = buildCandidateEvidence(news);
      const sharedNameTokens = intersection(communityEvidence.nameTokens, newsEvidence.nameTokens);
      const sharedKeywordTokens = intersection(communityEvidence.keywordTokens, newsEvidence.keywordTokens);
      const sharedEntityTokens = intersection(communityEvidence.entityTokens, newsEvidence.entityTokens);
      const sharedKeywordPhrases = intersection(communityEvidence.keywordPhrases, newsEvidence.keywordPhrases);
      const canonicalMatch =
        Boolean(communityEvidence.canonical) && communityEvidence.canonical === newsEvidence.canonical;

      const hasNameAndKeyword = sharedNameTokens.length >= 1 && sharedKeywordTokens.length >= 1;
      const hasCanonicalPartial = canonicalMatch && (sharedNameTokens.length >= 1 || sharedKeywordTokens.length >= 1);
      if (!hasNameAndKeyword && !hasCanonicalPartial) {
        continue;
      }

      const communityTime = topicTimestamp(community);
      const newsTime = topicTimestamp(news);
      const lagMinutes = Math.round((new Date(newsTime).getTime() - new Date(communityTime).getTime()) / 60000);
      if (!Number.isFinite(lagMinutes)) {
        continue;
      }

      const leader = resolveLeader(lagMinutes);
      if (!directionAllowsLeader(direction, leader)) {
        continue;
      }

      const matchReasons = [
        ...sharedNameTokens.slice(0, 3).map((token) => `이름 토큰: ${token}`),
        ...sharedKeywordTokens.slice(0, 3).map((token) => `키워드 토큰: ${token}`),
        ...sharedEntityTokens.slice(0, 2).map((token) => `엔티티: ${token}`),
        ...sharedKeywordPhrases.slice(0, 2).map((token) => `키워드 phrase: ${token}`),
        ...(canonicalMatch ? ["의미 있는 canonical 부분 일치"] : []),
      ];
      const matchScore = Number(
        Math.min(
          1,
          sharedNameTokens.length * 0.24 +
            sharedKeywordTokens.length * 0.18 +
            sharedEntityTokens.length * 0.18 +
            sharedKeywordPhrases.length * 0.16 +
            (canonicalMatch ? 0.22 : 0),
        ).toFixed(4),
      );
      const detectedAt = new Date(Math.max(new Date(communityTime).getTime(), new Date(newsTime).getTime())).toISOString();

      candidates.push({
        pairKey,
        regionId: community.region_id,
        leader,
        communityTopicId,
        communityTopicNameKo: community.name_ko ?? "",
        communityTopicNameEn: community.name_en ?? "",
        newsTopicId,
        newsTopicNameKo: news.name_ko ?? "",
        newsTopicNameEn: news.name_en ?? "",
        eventCount: 0,
        firstDetectedAt: detectedAt,
        lastDetectedAt: detectedAt,
        communityFirstPostAt: communityTime,
        newsFirstPostAt: newsTime,
        avgLagMinutes: Math.abs(lagMinutes),
        latestLagMinutes: lagMinutes,
        avgCosine: null,
        confidence: "candidate",
        matchReasons,
        matchScore,
      });
    }
  }

  const usedCommunityTopicIds = new Set<number>();
  const usedNewsTopicIds = new Set<number>();
  const selected: SourceTransferCandidatePairRow[] = [];
  for (const candidate of candidates.sort((left, right) => {
    if (right.matchScore !== left.matchScore) {
      return right.matchScore - left.matchScore;
    }
    return Math.abs(left.latestLagMinutes ?? 0) - Math.abs(right.latestLagMinutes ?? 0);
  })) {
    if (usedCommunityTopicIds.has(candidate.communityTopicId) || usedNewsTopicIds.has(candidate.newsTopicId)) {
      continue;
    }
    usedCommunityTopicIds.add(candidate.communityTopicId);
    usedNewsTopicIds.add(candidate.newsTopicId);
    selected.push(candidate);
  }

  const returned = selected.slice(0, limit);
  return {
    pairs: returned,
    summary: {
      totalCandidates: selected.length,
      returnedCandidates: returned.length,
    },
  };
}

function buildSnapshotCte() {
  return `
    with snapshot_base as (
      select *
      from issue_overlap_events
      where analyzer_run_at = $1::timestamptz
        and ($2::text = 'all' or region_id = $2::text)
        and ${buildCanonicalFilterSql("canonical_key")}
    ),
    snapshot_filtered as (
      select *
      from snapshot_base
      where (
        ($3::text = 'community_to_news' and leader = 'community')
        or ($3::text = 'news_to_community' and leader = 'news')
        or ($3::text = 'both' and leader in ('community', 'news', 'tie'))
      )
    )
  `;
}

function buildHistoryCte() {
  return `
    with history_base as (
      select *
      from issue_overlap_events
      where detected_at >= now() - ($1::text || ' hours')::interval
        and ($2::text = 'all' or region_id = $2::text)
        and ${buildCanonicalFilterSql("canonical_key")}
    ),
    history_filtered as (
      select *
      from history_base
      where (
        ($3::text = 'community_to_news' and leader = 'community')
        or ($3::text = 'news_to_community' and leader = 'news')
        or ($3::text = 'both' and leader in ('community', 'news', 'tie'))
      )
    )
  `;
}

function buildPairKey(regionId: string, communityTopicId: number, newsTopicId: number): string {
  return `${regionId}:${communityTopicId}:${newsTopicId}`;
}

function toLabel(nameKo: string | null | undefined, nameEn: string | null | undefined, fallback: string): string {
  const ko = (nameKo ?? "").trim();
  const en = (nameEn ?? "").trim();
  if (ko) return ko;
  if (en) return en;
  return fallback;
}

function buildTrendSeries(rows: TrendRow[], hours: number) {
  const map = new Map<number, TrendRow>();
  for (const row of rows) {
    const ms = new Date(row.bucket).getTime();
    if (Number.isFinite(ms)) {
      map.set(ms, row);
    }
  }

  const end = new Date();
  end.setUTCMinutes(0, 0, 0);
  const start = new Date(end.getTime() - (hours - 1) * 60 * 60 * 1000);

  const series: Array<{
    hour: string;
    eventCount: number;
    avgLagMinutes: number | null;
    communityLeadCount: number;
    newsLeadCount: number;
    tieCount: number;
  }> = [];

  for (let index = 0; index < hours; index += 1) {
    const bucket = new Date(start.getTime() + index * 60 * 60 * 1000);
    const bucketMs = bucket.getTime();
    const row = map.get(bucketMs);
    series.push({
      hour: bucket.toISOString(),
      eventCount: row ? toNumber(row.event_count) : 0,
      avgLagMinutes: row ? toNullableNumber(row.avg_lag_minutes) : null,
      communityLeadCount: row ? toNumber(row.community_lead_count) : 0,
      newsLeadCount: row ? toNumber(row.news_lead_count) : 0,
      tieCount: row ? toNumber(row.tie_count) : 0,
    });
  }

  return series;
}

function toSummary(
  row: SummaryRow | undefined,
  allDirectionRow: LeadCountsRow | undefined,
  direction: SourceTransferDirection,
): SourceTransferSummary {
  const allCommunityLead = toNumber(allDirectionRow?.community_lead_count);
  const allNewsLead = toNumber(allDirectionRow?.news_lead_count);
  const bidirectionalTotal = Math.max(allCommunityLead + allNewsLead, 0);

  const forwardLeadCount =
    direction === "news_to_community"
      ? allNewsLead
      : direction === "community_to_news"
        ? allCommunityLead
        : bidirectionalTotal;
  const forwardLeadShare =
    direction === "both"
      ? null
      : bidirectionalTotal > 0
        ? Number((forwardLeadCount / bidirectionalTotal).toFixed(4))
        : null;

  return {
    totalEvents: toNumber(row?.total_events),
    uniquePairs: toNumber(row?.unique_pairs),
    communityLeadCount: toNumber(row?.community_lead_count),
    newsLeadCount: toNumber(row?.news_lead_count),
    tieCount: toNumber(row?.tie_count),
    forwardLeadCount,
    forwardLeadShare,
    medianLagMinutes: toNullableNumber(row?.median_lag_minutes),
    p90LagMinutes: toNullableNumber(row?.p90_lag_minutes),
    latestDetectedAt: row?.latest_detected_at ?? null,
  };
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/analytics/source-transfer", async () => {
    const { searchParams } = new URL(request.url);
    const direction = parseDirection(searchParams.get("direction"));
    const hours = parseHours(searchParams.get("hours"));
    const region = parseRegion(searchParams.get("region"));
    const limit = parseLimit(searchParams.get("limit"));
    const offset = parseOffset(searchParams.get("offset"));

    const emptySummary: SourceTransferSummary = {
      totalEvents: 0,
      uniquePairs: 0,
      communityLeadCount: 0,
      newsLeadCount: 0,
      tieCount: 0,
      forwardLeadCount: 0,
      forwardLeadShare: null,
      medianLagMinutes: null,
      p90LagMinutes: null,
      latestDetectedAt: null,
    };

    const postgres = getPostgresPoolOrNull();
    if (!postgres) {
      return NextResponse.json({
        summary: emptySummary,
        snapshotSummary: emptySummary,
        historySummary: emptySummary,
        latestAnalyzerRunAt: null,
        sankey: {
          nodes: [],
          links: [],
        },
        trendHourly: [],
        pairs: [],
        candidatePairs: [],
        candidateSummary: {
          totalCandidates: 0,
          returnedCandidates: 0,
        },
        meta: {
          direction,
          hours,
          region,
          limit,
          offset,
          totalPairs: 0,
          returnedPairs: 0,
        },
        configured: false,
        provider: "none",
        lastUpdated: new Date().toISOString(),
      });
    }

    const latestRunResult = await postgres.query<{ latest_analyzer_run_at: string | null }>(
      `
      select max(analyzer_run_at)::text as latest_analyzer_run_at
      from issue_overlap_events
      `,
    );
    const latestAnalyzerRunAt = latestRunResult.rows[0]?.latest_analyzer_run_at ?? null;

    const historyCte = buildHistoryCte();
    const historyParams: [number, string, SourceTransferDirection] = [hours, region, direction];
    const [historySummaryResult, historyLeadCountsResult, trendResult] = await Promise.all([
      postgres.query<SummaryRow>(
        `
        ${historyCte}
        select
          count(*)::int as total_events,
          count(distinct region_id || ':' || community_topic_id::text || ':' || news_topic_id::text)::int as unique_pairs,
          count(*) filter (where leader = 'community')::int as community_lead_count,
          count(*) filter (where leader = 'news')::int as news_lead_count,
          count(*) filter (where leader = 'tie')::int as tie_count,
          percentile_cont(0.5) within group (order by abs(lag_minutes))
            filter (where lag_minutes is not null) as median_lag_minutes,
          percentile_cont(0.9) within group (order by abs(lag_minutes))
            filter (where lag_minutes is not null) as p90_lag_minutes,
          max(detected_at)::text as latest_detected_at
        from history_filtered
        `,
        historyParams,
      ),
      postgres.query<LeadCountsRow>(
        `
        ${historyCte}
        select
          count(*) filter (where leader = 'community')::int as community_lead_count,
          count(*) filter (where leader = 'news')::int as news_lead_count
        from history_base
        `,
        historyParams,
      ),
      postgres.query<TrendRow>(
        `
        ${historyCte}
        select
          date_trunc('hour', detected_at)::text as bucket,
          count(*)::int as event_count,
          avg(abs(lag_minutes)) filter (where lag_minutes is not null) as avg_lag_minutes,
          count(*) filter (where leader = 'community')::int as community_lead_count,
          count(*) filter (where leader = 'news')::int as news_lead_count,
          count(*) filter (where leader = 'tie')::int as tie_count
        from history_filtered
        group by date_trunc('hour', detected_at)
        order by date_trunc('hour', detected_at) asc
        `,
        historyParams,
      ),
    ]);

    let snapshotSummaryResult: SummaryRow | undefined;
    let snapshotLeadCountsResult: LeadCountsRow | undefined;
    let totalPairs = 0;
    let pairRows: PairRow[] = [];
    let sankeyRows: PairRow[] = [];

    if (latestAnalyzerRunAt) {
      const snapshotCte = buildSnapshotCte();
      const snapshotParams: [string, string, SourceTransferDirection] = [latestAnalyzerRunAt, region, direction];
      const [snapshotSummaryQueryResult, snapshotLeadCountsQueryResult, totalPairsResult, pairsResult, sankeyPairsResult] =
        await Promise.all([
          postgres.query<SummaryRow>(
            `
            ${snapshotCte}
            select
              count(*)::int as total_events,
              count(distinct region_id || ':' || community_topic_id::text || ':' || news_topic_id::text)::int as unique_pairs,
              count(*) filter (where leader = 'community')::int as community_lead_count,
              count(*) filter (where leader = 'news')::int as news_lead_count,
              count(*) filter (where leader = 'tie')::int as tie_count,
              percentile_cont(0.5) within group (order by abs(lag_minutes))
                filter (where lag_minutes is not null) as median_lag_minutes,
              percentile_cont(0.9) within group (order by abs(lag_minutes))
                filter (where lag_minutes is not null) as p90_lag_minutes,
              max(detected_at)::text as latest_detected_at
            from snapshot_filtered
            `,
            snapshotParams,
          ),
          postgres.query<LeadCountsRow>(
            `
            ${snapshotCte}
            select
              count(*) filter (where leader = 'community')::int as community_lead_count,
              count(*) filter (where leader = 'news')::int as news_lead_count
            from snapshot_base
            `,
            snapshotParams,
          ),
          postgres.query<{ total_pairs: number | string }>(
            `
            ${snapshotCte}
            select count(*)::int as total_pairs
            from (
              select 1
              from snapshot_filtered
              group by region_id, community_topic_id, news_topic_id
            ) grouped
            `,
            snapshotParams,
          ),
          postgres.query<PairRow>(
            `
            ${snapshotCte}
            ,
            latest as (
              select distinct on (region_id, community_topic_id, news_topic_id)
                region_id,
                community_topic_id,
                news_topic_id,
                leader,
                lag_minutes as latest_lag_minutes,
                detected_at as last_detected_at,
                community_topic_name_ko,
                community_topic_name_en,
                news_topic_name_ko,
                news_topic_name_en,
                community_first_post_at,
                news_first_post_at
              from snapshot_filtered
              order by region_id, community_topic_id, news_topic_id, detected_at desc, id desc
            ),
            stats as (
              select
                region_id,
                community_topic_id,
                news_topic_id,
                count(*)::int as event_count,
                min(detected_at)::text as first_detected_at,
                max(detected_at)::text as last_detected_at,
                avg(abs(lag_minutes)) filter (where lag_minutes is not null) as avg_lag_minutes,
                avg(cosine) filter (where cosine is not null) as avg_cosine,
                min(community_first_post_at)::text as community_first_post_at,
                min(news_first_post_at)::text as news_first_post_at
              from snapshot_filtered
              group by region_id, community_topic_id, news_topic_id
            )
            select
              s.region_id,
              l.leader,
              s.community_topic_id,
              l.community_topic_name_ko,
              l.community_topic_name_en,
              s.news_topic_id,
              l.news_topic_name_ko,
              l.news_topic_name_en,
              s.event_count,
              s.first_detected_at,
              s.last_detected_at,
              s.avg_lag_minutes,
              l.latest_lag_minutes,
              s.avg_cosine,
              s.community_first_post_at,
              s.news_first_post_at
            from stats s
            join latest l
              on l.region_id = s.region_id
             and l.community_topic_id = s.community_topic_id
             and l.news_topic_id = s.news_topic_id
            order by coalesce(s.avg_cosine, 0) desc, abs(coalesce(l.latest_lag_minutes, 0)) asc, s.last_detected_at desc
            offset $4
            limit $5
            `,
            [...snapshotParams, offset, limit],
          ),
          postgres.query<PairRow>(
            `
            ${snapshotCte}
            ,
            latest as (
              select distinct on (region_id, community_topic_id, news_topic_id)
                region_id,
                community_topic_id,
                news_topic_id,
                leader,
                lag_minutes as latest_lag_minutes,
                detected_at as last_detected_at,
                community_topic_name_ko,
                community_topic_name_en,
                news_topic_name_ko,
                news_topic_name_en,
                community_first_post_at,
                news_first_post_at
              from snapshot_filtered
              order by region_id, community_topic_id, news_topic_id, detected_at desc, id desc
            ),
            stats as (
              select
                region_id,
                community_topic_id,
                news_topic_id,
                count(*)::int as event_count,
                min(detected_at)::text as first_detected_at,
                max(detected_at)::text as last_detected_at,
                avg(abs(lag_minutes)) filter (where lag_minutes is not null) as avg_lag_minutes,
                avg(cosine) filter (where cosine is not null) as avg_cosine,
                min(community_first_post_at)::text as community_first_post_at,
                min(news_first_post_at)::text as news_first_post_at
              from snapshot_filtered
              group by region_id, community_topic_id, news_topic_id
            )
            select
              s.region_id,
              l.leader,
              s.community_topic_id,
              l.community_topic_name_ko,
              l.community_topic_name_en,
              s.news_topic_id,
              l.news_topic_name_ko,
              l.news_topic_name_en,
              s.event_count,
              s.first_detected_at,
              s.last_detected_at,
              s.avg_lag_minutes,
              l.latest_lag_minutes,
              s.avg_cosine,
              s.community_first_post_at,
              s.news_first_post_at
            from stats s
            join latest l
              on l.region_id = s.region_id
             and l.community_topic_id = s.community_topic_id
             and l.news_topic_id = s.news_topic_id
            order by coalesce(s.avg_cosine, 0) desc, abs(coalesce(l.latest_lag_minutes, 0)) asc, s.last_detected_at desc
            limit 8
            `,
            snapshotParams,
          ),
        ]);

      snapshotSummaryResult = snapshotSummaryQueryResult.rows[0];
      snapshotLeadCountsResult = snapshotLeadCountsQueryResult.rows[0];
      totalPairs = toNumber(totalPairsResult.rows[0]?.total_pairs);
      pairRows = pairsResult.rows;
      sankeyRows = sankeyPairsResult.rows;
    }

    const snapshotSummary = toSummary(snapshotSummaryResult, snapshotLeadCountsResult, direction);
    const historySummary = toSummary(historySummaryResult.rows[0], historyLeadCountsResult.rows[0], direction);

    const pairs = pairRows.map((row) => {
      const communityTopicId = toNumber(row.community_topic_id);
      const newsTopicId = toNumber(row.news_topic_id);
      return {
        pairKey: buildPairKey(row.region_id, communityTopicId, newsTopicId),
        regionId: row.region_id,
        leader: row.leader,
        communityTopicId,
        communityTopicNameKo: row.community_topic_name_ko ?? "",
        communityTopicNameEn: row.community_topic_name_en ?? "",
        newsTopicId,
        newsTopicNameKo: row.news_topic_name_ko ?? "",
        newsTopicNameEn: row.news_topic_name_en ?? "",
        eventCount: toNumber(row.event_count),
        firstDetectedAt: row.first_detected_at,
        lastDetectedAt: row.last_detected_at,
        avgLagMinutes: toNullableNumber(row.avg_lag_minutes),
        latestLagMinutes: toNullableNumber(row.latest_lag_minutes),
        avgCosine: toNullableNumber(row.avg_cosine),
        communityFirstPostAt: row.community_first_post_at ?? null,
        newsFirstPostAt: row.news_first_post_at ?? null,
      };
    });

    let candidatePairs: SourceTransferCandidatePairRow[] = [];
    let candidateSummary: SourceTransferCandidateSummary = {
      totalCandidates: 0,
      returnedCandidates: 0,
    };

    if (offset === 0 && totalPairs < Math.min(3, limit)) {
      const candidateTopicsResult = await postgres.query<TopicCandidateRow>(
        `
        with ranked as (
          select
            id,
            region_id,
            scope,
            name_ko,
            name_en,
            summary_ko,
            summary_en,
            sample_titles,
            keywords,
            entities,
            aliases,
            canonical_key,
            heat_score,
            post_count,
            period_start::text as period_start,
            row_number() over (
              partition by scope, region_id
              order by coalesce(heat_score, 0) desc, period_start desc, id desc
            ) as rn
          from topics
          where period_start >= now() - ($1::text || ' hours')::interval
            and scope in ('community', 'news')
            and ($2::text = 'all' or region_id = $2::text)
        )
        select
          id,
          region_id,
          scope,
          name_ko,
          name_en,
          summary_ko,
          summary_en,
          sample_titles,
          keywords,
          entities,
          aliases,
          canonical_key,
          heat_score,
          post_count,
          period_start
        from ranked
        where rn <= 80
        `,
        [hours, region],
      );
      const candidateResult = buildCandidatePairs(candidateTopicsResult.rows, pairs, direction, Math.min(limit, 30));
      candidatePairs = candidateResult.pairs;
      candidateSummary = candidateResult.summary;
    }

    const nodes: Array<{ id: string; label: string; scope: "community" | "news"; topicId: number }> = [];
    const links: Array<{
      source: number;
      target: number;
      value: number;
      avgLagMinutes: number | null;
      pairKey: string;
      leader: "community" | "news" | "tie";
    }> = [];
    const nodeIndexById = new Map<string, number>();

    for (const row of sankeyRows) {
      const communityTopicId = toNumber(row.community_topic_id);
      const newsTopicId = toNumber(row.news_topic_id);
      if (communityTopicId <= 0 || newsTopicId <= 0) {
        continue;
      }

      const drawAsNewsLead = direction === "news_to_community" || (direction === "both" && row.leader === "news");
      const fromId = drawAsNewsLead ? `news:${newsTopicId}` : `community:${communityTopicId}`;
      const toId = drawAsNewsLead ? `community:${communityTopicId}` : `news:${newsTopicId}`;
      const fromScope: "community" | "news" = drawAsNewsLead ? "news" : "community";
      const toScope: "community" | "news" = drawAsNewsLead ? "community" : "news";
      const fromLabel = drawAsNewsLead
        ? toLabel(row.news_topic_name_ko, row.news_topic_name_en, `News #${newsTopicId}`)
        : toLabel(row.community_topic_name_ko, row.community_topic_name_en, `Community #${communityTopicId}`);
      const toLabelText = drawAsNewsLead
        ? toLabel(row.community_topic_name_ko, row.community_topic_name_en, `Community #${communityTopicId}`)
        : toLabel(row.news_topic_name_ko, row.news_topic_name_en, `News #${newsTopicId}`);
      const cosine = toNullableNumber(row.avg_cosine);
      const linkValue = Math.max(1, Math.round((cosine ?? 0.5) * 100));

      if (!nodeIndexById.has(fromId)) {
        nodeIndexById.set(fromId, nodes.length);
        nodes.push({
          id: fromId,
          label: fromLabel,
          scope: fromScope,
          topicId: fromScope === "community" ? communityTopicId : newsTopicId,
        });
      }

      if (!nodeIndexById.has(toId)) {
        nodeIndexById.set(toId, nodes.length);
        nodes.push({
          id: toId,
          label: toLabelText,
          scope: toScope,
          topicId: toScope === "community" ? communityTopicId : newsTopicId,
        });
      }

      links.push({
        source: nodeIndexById.get(fromId) ?? 0,
        target: nodeIndexById.get(toId) ?? 0,
        value: linkValue,
        avgLagMinutes: toNullableNumber(row.avg_lag_minutes),
        pairKey: buildPairKey(row.region_id, communityTopicId, newsTopicId),
        leader: row.leader,
      });
    }

    return NextResponse.json({
      summary: snapshotSummary,
      snapshotSummary,
      historySummary,
      latestAnalyzerRunAt,
      sankey: {
        nodes,
        links,
      },
      trendHourly: buildTrendSeries(trendResult.rows, hours),
      pairs,
      candidatePairs,
      candidateSummary,
      meta: {
        direction,
        hours,
        region,
        limit,
        offset,
        totalPairs,
        returnedPairs: pairs.length,
      },
      configured: true,
      provider: "postgres",
      lastUpdated: new Date().toISOString(),
    });
  });
}
