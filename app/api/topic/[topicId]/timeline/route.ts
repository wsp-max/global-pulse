import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../../../_shared/postgres-server";
import { withApiRequestLog } from "../../../_shared/route-logger";

interface TopicTimelineRouteContext {
  params: Promise<{ topicId: string }>;
}

interface TopicRow {
  id: number;
  region_id: string;
  name_en: string;
  lifecycle_stage: "emerging" | "peaking" | "fading" | null;
}

interface GlobalTopicRow {
  topic_ids: number[] | null;
}

interface BucketRow {
  bucket_at: string;
  heat_score: number | string | null;
  post_count: number | string | null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function deriveLifecycleFromBuckets(
  buckets: Array<{ heatScore: number; bucketAt: string }>,
  fallback: "emerging" | "peaking" | "fading" | null,
): "emerging" | "peaking" | "fading" {
  if (fallback) {
    return fallback;
  }

  if (buckets.length === 0) {
    return "emerging";
  }

  const firstMs = new Date(buckets[0].bucketAt).getTime();
  const nowMs = Date.now();
  if (Number.isFinite(firstMs) && nowMs - firstMs < 6 * 60 * 60 * 1000) {
    return "emerging";
  }

  const latest = buckets.at(-1)?.heatScore ?? 0;
  const prev = buckets.at(-2)?.heatScore ?? latest;
  const prev2 = buckets.at(-3)?.heatScore ?? prev;
  const peak = Math.max(...buckets.map((item) => item.heatScore));

  if (latest < prev && prev < prev2 && latest < peak) {
    return "fading";
  }

  return "peaking";
}

export async function GET(request: Request, context: TopicTimelineRouteContext) {
  return withApiRequestLog(request, "/api/topic/[topicId]/timeline", async () => {
    const postgres = getPostgresPoolOrNull();
    const { topicId } = await context.params;
    const numericTopicId = Number(topicId);

    if (!Number.isFinite(numericTopicId)) {
      return NextResponse.json({ error: "Invalid topic id." }, { status: 400 });
    }

    if (!postgres) {
      return NextResponse.json({
        topicId: numericTopicId,
        regionId: null,
        topicName: null,
        lifecycleStage: "emerging",
        buckets: [],
        configured: false,
      });
    }

    let topic = (
      await postgres.query<TopicRow>(
        `
        select id, region_id, name_en, lifecycle_stage
        from topics
        where id = $1
        limit 1
        `,
        [numericTopicId],
      )
    ).rows[0];

    if (!topic) {
      const globalRow = (
        await postgres.query<GlobalTopicRow>(
          `
          select topic_ids
          from global_topics
          where id = $1
          limit 1
          `,
          [numericTopicId],
        )
      ).rows[0];

      const fallbackTopicId = globalRow?.topic_ids?.[0];
      if (fallbackTopicId) {
        topic = (
          await postgres.query<TopicRow>(
            `
            select id, region_id, name_en, lifecycle_stage
            from topics
            where id = $1
            limit 1
            `,
            [fallbackTopicId],
          )
        ).rows[0];
      }
    }

    if (!topic) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }

    const bucketRows = (
      await postgres.query<BucketRow>(
        `
        select
          to_char(
            date_trunc('hour', recorded_at)
              - ((extract(hour from recorded_at)::int % 6) || ' hours')::interval,
            'YYYY-MM-DD"T"HH24:MI:SS"Z"'
          ) as bucket_at,
          avg(heat_score) as heat_score,
          sum(post_count) as post_count
        from heat_history
        where region_id = $1
          and topic_name = $2
          and recorded_at >= now() - interval '7 days'
        group by 1
        order by 1 asc
        `,
        [topic.region_id, topic.name_en],
      )
    ).rows;

    const buckets = bucketRows.map((row) => ({
      bucketAt: row.bucket_at,
      heatScore: toNumber(row.heat_score),
      postCount: toNumber(row.post_count),
    }));

    return NextResponse.json({
      topicId: numericTopicId,
      regionId: topic.region_id,
      topicName: topic.name_en,
      lifecycleStage: deriveLifecycleFromBuckets(buckets, topic.lifecycle_stage),
      buckets,
      configured: true,
      lastUpdated: new Date().toISOString(),
    });
  });
}
