import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";

export const dynamic = "force-dynamic";

interface AnalyzerHealthRow {
  total_topics: number | string;
  enriched_topics: number | string;
  fallback_topics: number | string;
  avg_summary_ko_length: number | string | null;
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

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/analyzer/health", async () => {
    const pool = getPostgresPoolOrNull();

    if (!pool) {
      return NextResponse.json({
        configured: false,
        provider: "none",
        metrics: {
          totalTopics24h: 0,
          geminiSuccessRate: 0,
          avgSummaryKoLength: 0,
          fallbackRatio: 1,
        },
        lastUpdated: new Date().toISOString(),
      });
    }

    const { rows } = await pool.query<AnalyzerHealthRow>(
      `
      select
        count(*) as total_topics,
        count(*) filter (
          where coalesce(summary_ko, '') <> ''
            and summary_ko <> '요약 준비 중'
        ) as enriched_topics,
        count(*) filter (
          where summary_ko = '요약 준비 중'
             or summary_en = 'Summary pending'
        ) as fallback_topics,
        avg(length(summary_ko)) filter (where coalesce(summary_ko, '') <> '') as avg_summary_ko_length
      from topics
      where created_at >= now() - interval '24 hours'
      `,
    );

    const row = rows[0];
    const totalTopics = toNumber(row?.total_topics);
    const enrichedTopics = toNumber(row?.enriched_topics);
    const fallbackTopics = toNumber(row?.fallback_topics);
    const successRate = totalTopics > 0 ? enrichedTopics / totalTopics : 0;
    const fallbackRatio = totalTopics > 0 ? fallbackTopics / totalTopics : 0;

    return NextResponse.json({
      configured: true,
      provider: "postgres",
      metrics: {
        totalTopics24h: totalTopics,
        geminiSuccessRate: Number(successRate.toFixed(4)),
        avgSummaryKoLength: Number(toNumber(row?.avg_summary_ko_length).toFixed(2)),
        fallbackRatio: Number(fallbackRatio.toFixed(4)),
      },
      lastUpdated: new Date().toISOString(),
    });
  });
}
