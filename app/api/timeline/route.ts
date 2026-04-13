import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../_shared/postgres-server";
import { withApiRequestLog } from "../_shared/route-logger";

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/timeline", () => getTimeline(request));
}

async function getTimeline(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") ?? "";
  const region = searchParams.get("region") ?? null;
  const hours = Math.min(Number(searchParams.get("hours") ?? 24), 168);
  const startIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const postgres = getPostgresPoolOrNull();
  if (postgres) {
    try {
      let topicFilter = topic.trim();
      if (/^\d+$/.test(topicFilter)) {
        const topicLookup = await postgres.query<{ name_en: string | null }>(
          "select name_en from topics where id = $1 limit 1",
          [Number(topicFilter)],
        );
        if (topicLookup.rows[0]?.name_en) {
          topicFilter = topicLookup.rows[0].name_en;
        }
      }

      const params: Array<string | number> = [startIso];
      let whereClause = "recorded_at >= $1";
      let index = 2;

      if (region) {
        whereClause += ` and region_id = $${index}`;
        params.push(region);
        index += 1;
      }

      if (topicFilter) {
        whereClause += ` and topic_name ilike $${index}`;
        params.push(`%${topicFilter}%`);
      }

      const { rows } = await postgres.query<{
        region_id: string;
        topic_name: string;
        heat_score: number | string | null;
        sentiment: number | string | null;
        post_count: number | string | null;
        recorded_at: string;
      }>(
        `
        select region_id,topic_name,heat_score,sentiment,post_count,recorded_at
        from heat_history
        where ${whereClause}
        order by recorded_at asc
        limit 1000
        `,
        params,
      );

      const timeline = rows.map((row) => ({
        regionId: row.region_id,
        topicName: row.topic_name,
        heatScore: Number(row.heat_score ?? 0),
        sentiment: Number(row.sentiment ?? 0),
        postCount: Number(row.post_count ?? 0),
        recordedAt: row.recorded_at,
      }));

      return NextResponse.json({
        timeline,
        topic,
        region,
        hours,
        regions: [...new Set(timeline.map((item) => item.regionId))],
        configured: true,
        provider: "postgres",
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error), timeline: [] },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    timeline: [],
    topic,
    region,
    hours,
    regions: [],
    configured: false,
    provider: "none",
  });
}


