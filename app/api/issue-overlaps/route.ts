import { NextResponse } from "next/server";
import { withApiRequestLog } from "../_shared/route-logger";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/issue-overlaps", () => getIssueOverlaps(request));
}

async function getIssueOverlaps(request: Request) {
  const { searchParams } = new URL(request.url);
  const minTier = Math.max(1, Math.min(Number(searchParams.get("minTier") ?? 2), 3));
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 20), 100));

  const postgres = getPostgresPoolOrNull();
  if (!postgres) {
    return NextResponse.json({
      minTier,
      limit,
      overlaps: [],
      configured: false,
      lastUpdated: new Date().toISOString(),
    });
  }

  const { rows } = await postgres.query<{
    id: number;
    canonical_key: string | null;
    cosine: number | null;
    lag_minutes: number | null;
    leader: "community" | "news" | "tie" | null;
    detected_at: string;
    region_id: string;
    community_topic_id: number;
    community_name_ko: string;
    community_name_en: string;
    community_rank: number | null;
    news_topic_id: number;
    news_name_ko: string;
    news_name_en: string;
    news_rank: number | null;
  }>(
    `
    select
      io.id,
      io.canonical_key,
      io.cosine,
      io.lag_minutes,
      io.leader,
      io.detected_at,
      tc.region_id,
      tc.id as community_topic_id,
      tc.name_ko as community_name_ko,
      tc.name_en as community_name_en,
      tc.rank as community_rank,
      tn.id as news_topic_id,
      tn.name_ko as news_name_ko,
      tn.name_en as news_name_en,
      tn.rank as news_rank
    from issue_overlaps io
    join topics tc on tc.id = io.community_topic_id
    join topics tn on tn.id = io.news_topic_id
    where tc.scope = 'community'
      and tn.scope = 'news'
      and io.detected_at = (
        select max(detected_at)
        from issue_overlaps
      )
      and exists (
        select 1
        from unnest(coalesce(tn.source_ids, '{}'::text[])) as sid(source_id)
        join sources s on s.id = sid.source_id
        where coalesce(s.trust_tier, 3) <= $1
      )
    order by io.detected_at desc
    limit $2
    `,
    [minTier, limit],
  );

  return NextResponse.json({
    minTier,
    limit,
    overlaps: rows.map((row) => ({
      id: row.id,
      canonicalKey: row.canonical_key,
      cosine: row.cosine,
      lagMinutes: row.lag_minutes,
      leader: row.leader,
      detectedAt: row.detected_at,
      regionId: row.region_id,
      communityTopic: {
        id: row.community_topic_id,
        nameKo: row.community_name_ko,
        nameEn: row.community_name_en,
        rank: row.community_rank,
      },
      newsTopic: {
        id: row.news_topic_id,
        nameKo: row.news_name_ko,
        nameEn: row.news_name_en,
        rank: row.news_rank,
      },
    })),
    configured: true,
    lastUpdated: new Date().toISOString(),
  });
}
