import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";
import {
  mapGlobalTopicRow,
  mapTopicRow,
  type GlobalTopicRow,
  type TopicRow,
} from "../_shared/mappers";

function sanitizeTerm(value: string): string {
  return value.replace(/[%(),]/g, " ").trim();
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/search", () => searchTopics(request));
}

async function searchTopics(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const region = searchParams.get("region") ?? null;

  if (!query) {
    return NextResponse.json({
      topics: [],
      globalTopics: [],
      total: 0,
      configured: true,
      provider: "none",
    });
  }

  const postgres = getPostgresPoolOrNull();
  if (postgres) {
    try {
      const term = `%${sanitizeTerm(query)}%`;
      const topicParams: Array<string> = [term];
      let topicWhere = `
        (
          name_ko ilike $1
          or name_en ilike $1
          or coalesce(summary_ko, '') ilike $1
          or coalesce(summary_en, '') ilike $1
        )
      `;

      if (region) {
        topicWhere += " and region_id = $2";
        topicParams.push(region);
      }

      const [topicsResult, globalTopicsResult] = await Promise.all([
        postgres.query<TopicRow>(
          `
          select
            id,region_id,name_ko,name_en,summary_ko,summary_en,sample_titles,keywords,sentiment,category,entities,aliases,canonical_key,embedding_json,heat_score,heat_score_display,
            post_count,total_views,total_likes,total_comments,source_ids,raw_post_ids,burst_z,rank,period_start,period_end,
            null::float as velocity_per_hour,
            null::float as acceleration,
            null::float as spread_score,
            null::jsonb as propagation_timeline,
            null::jsonb as propagation_edges
          from topics
          where ${topicWhere}
          order by heat_score desc
          limit 20
          `,
          topicParams,
        ),
        postgres.query<GlobalTopicRow>(
          `
          select
            id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
            topic_ids,total_heat_score,heat_score_display,first_seen_region,first_seen_at,velocity_per_hour,acceleration,spread_score,propagation_timeline,propagation_edges,scope,created_at
          from global_topics
          where
            name_ko ilike $1
            or name_en ilike $1
            or coalesce(summary_ko, '') ilike $1
            or coalesce(summary_en, '') ilike $1
          order by total_heat_score desc
          limit 20
          `,
          [term],
        ),
      ]);

      const topics = topicsResult.rows.map(mapTopicRow);
      const globalTopics = globalTopicsResult.rows.map(mapGlobalTopicRow);

      return NextResponse.json({
        query,
        region,
        topics,
        globalTopics,
        total: topics.length + globalTopics.length,
        configured: true,
        provider: "postgres",
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : String(error),
          topics: [],
          globalTopics: [],
          total: 0,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    query,
    region,
    topics: [],
    globalTopics: [],
    total: 0,
    configured: false,
    provider: "none",
  });
}


