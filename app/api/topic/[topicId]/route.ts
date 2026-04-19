import { NextResponse } from "next/server";
import type { GlobalTopic, Topic } from "@global-pulse/shared";
import {
  mapGlobalTopicRow,
  mapTopicRow,
  type GlobalTopicRow,
  type TopicRow,
} from "../../_shared/mappers";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";

interface TopicDetailRouteContext {
  params: Promise<{ topicId: string }>;
}

interface TimelineRow {
  region_id: string;
  topic_name: string;
  heat_score: number | null;
  sentiment: number | null;
  post_count: number | null;
  recorded_at: string;
}

function toTimeline(rows: TimelineRow[]) {
  return rows.map((row) => ({
    regionId: row.region_id,
    topicName: row.topic_name,
    heatScore: row.heat_score ?? 0,
    sentiment: row.sentiment ?? 0,
    postCount: row.post_count ?? 0,
    recordedAt: row.recorded_at,
  }));
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function buildKeywordSet(globalTopic: GlobalTopic, regionalTopics: Topic[]): string[] {
  const tokenMap = new Map<string, number>();

  for (const topic of regionalTopics) {
    for (const keyword of topic.keywords) {
      const token = keyword.trim();
      if (!token) continue;
      tokenMap.set(token, (tokenMap.get(token) ?? 0) + 1);
    }
  }

  const names = [globalTopic.nameKo, globalTopic.nameEn];
  for (const name of names) {
    const token = name.trim();
    if (!token) continue;
    tokenMap.set(token, (tokenMap.get(token) ?? 0) + 1);
  }

  return [...tokenMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([keyword]) => keyword);
}

export async function GET(request: Request, context: TopicDetailRouteContext) {
  return withApiRequestLog(request, "/api/topic/[topicId]", () => getTopicDetail(context));
}

async function getTopicDetail(context: TopicDetailRouteContext) {
  const { topicId } = await context.params;
  const numericTopicId = Number(topicId);

  if (!Number.isFinite(numericTopicId)) {
    return NextResponse.json({ error: "Invalid topic id." }, { status: 400 });
  }

  const postgres = getPostgresPoolOrNull();
  if (postgres) {
    const globalResult = await postgres.query<GlobalTopicRow>(
      `
      select
        id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
        topic_ids,total_heat_score,first_seen_region,first_seen_at,velocity_per_hour,acceleration,spread_score,
        propagation_timeline,propagation_edges,created_at
      from global_topics
      where id = $1
      limit 1
      `,
      [numericTopicId],
    );

    if (globalResult.rows[0]) {
      const globalTopic = mapGlobalTopicRow(globalResult.rows[0]);
      const regionalIds = globalTopic.topicIds;
      const windowStart = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

      const [regionalTopicsResult, relatedGlobalResult, timelineResult] = await Promise.all([
        regionalIds.length > 0
          ? postgres.query<TopicRow>(
              `
              select
                id,region_id,name_ko,name_en,summary_ko,summary_en,keywords,sentiment,heat_score,post_count,
                total_views,total_likes,total_comments,source_ids,rank,period_start,period_end,created_at
              from topics
              where id = any($1::bigint[])
              `,
              [regionalIds],
            )
          : Promise.resolve({ rows: [] as TopicRow[] }),
        postgres.query<GlobalTopicRow>(
          `
          select
            id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
            topic_ids,total_heat_score,first_seen_region,first_seen_at,velocity_per_hour,acceleration,spread_score,
            propagation_timeline,propagation_edges,created_at
          from global_topics
          where id <> $1
          order by total_heat_score desc
          limit 30
          `,
          [numericTopicId],
        ),
        postgres.query<TimelineRow>(
          `
          select region_id,topic_name,heat_score,sentiment,post_count,recorded_at
          from heat_history
          where recorded_at >= $1
            and region_id = any($2::text[])
          order by recorded_at asc
          limit 3000
          `,
          [windowStart, globalTopic.regions.length > 0 ? globalTopic.regions : ["kr"]],
        ),
      ]);

      const regionalTopics = regionalTopicsResult.rows.map(mapTopicRow);
      const topicNames = new Set<string>(
        [
          globalTopic.nameKo,
          globalTopic.nameEn,
          ...regionalTopics.map((topic) => topic.nameKo),
          ...regionalTopics.map((topic) => topic.nameEn),
        ]
          .map(normalize)
          .filter(Boolean),
      );

      const filteredTimeline = timelineResult.rows.filter((row) => {
        const target = normalize(row.topic_name);
        for (const name of topicNames) {
          if (target.includes(name) || name.includes(target)) {
            return true;
          }
        }
        return false;
      });

      const relatedGlobalTopics = relatedGlobalResult.rows
        .map(mapGlobalTopicRow)
        .filter((topic) => topic.regions.some((regionId) => globalTopic.regions.includes(regionId)))
        .slice(0, 8);

      return NextResponse.json({
        kind: "global",
        configured: true,
        provider: "postgres",
        topicId: numericTopicId,
        globalTopic,
        topic: null,
        regionalTopics,
        keywords: buildKeywordSet(globalTopic, regionalTopics),
        timeline: toTimeline(filteredTimeline),
        relatedTopics: [],
        relatedGlobalTopics,
        lastUpdated: new Date().toISOString(),
      });
    }

    const regionalResult = await postgres.query<TopicRow>(
      `
      select
        id,region_id,name_ko,name_en,summary_ko,summary_en,keywords,sentiment,heat_score,post_count,
        total_views,total_likes,total_comments,source_ids,rank,period_start,period_end,created_at
      from topics
      where id = $1
      limit 1
      `,
      [numericTopicId],
    );

    if (!regionalResult.rows[0]) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }

    const topic = mapTopicRow(regionalResult.rows[0]);
    const windowStart = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [timelineResult, relatedTopicsResult, relatedGlobalResult] = await Promise.all([
      postgres.query<TimelineRow>(
        `
        select region_id,topic_name,heat_score,sentiment,post_count,recorded_at
        from heat_history
        where region_id = $1
          and topic_name ilike $2
          and recorded_at >= $3
        order by recorded_at asc
        limit 2000
        `,
        [topic.regionId, `%${topic.nameEn}%`, windowStart],
      ),
      postgres.query<TopicRow>(
        `
        select
          id,region_id,name_ko,name_en,summary_ko,summary_en,keywords,sentiment,heat_score,post_count,
          total_views,total_likes,total_comments,source_ids,rank,period_start,period_end,created_at
        from topics
        where region_id = $1 and id <> $2
        order by heat_score desc
        limit 10
        `,
        [topic.regionId, numericTopicId],
      ),
      postgres.query<GlobalTopicRow>(
        `
        select
          id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
          topic_ids,total_heat_score,first_seen_region,first_seen_at,velocity_per_hour,acceleration,spread_score,
          propagation_timeline,propagation_edges,created_at
        from global_topics
        where topic_ids is not null and $1 = any(topic_ids)
        order by total_heat_score desc
        limit 5
        `,
        [numericTopicId],
      ),
    ]);

    return NextResponse.json({
      kind: "regional",
      configured: true,
      provider: "postgres",
      topicId: numericTopicId,
      globalTopic: null,
      topic,
      regionalTopics: [],
      keywords: topic.keywords.slice(0, 30),
      timeline: toTimeline(timelineResult.rows),
      relatedTopics: relatedTopicsResult.rows.map(mapTopicRow),
      relatedGlobalTopics: relatedGlobalResult.rows.map(mapGlobalTopicRow),
      lastUpdated: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    kind: "not_configured",
    topicId: numericTopicId,
    configured: false,
    provider: "none",
    timeline: [],
    keywords: [],
    relatedTopics: [],
    relatedGlobalTopics: [],
    regionalTopics: [],
    globalTopic: null,
    topic: null,
  });
}
