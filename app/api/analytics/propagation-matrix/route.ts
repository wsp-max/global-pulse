import { NextResponse } from "next/server";
import { getAllRegions } from "@global-pulse/shared";
import type { GlobalTopic } from "@global-pulse/shared";
import type { DashboardScope } from "@/lib/types/api";
import { getSignalThreshold, prepareQualifiedGlobalTopics } from "@/lib/utils/signal-quality";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";
import { mapGlobalTopicRow, type GlobalTopicRow } from "../../_shared/mappers";

interface AggregatedCell {
  fromRegion: string;
  toRegion: string;
  edgeCount: number;
  avgLagMinutes: number | null;
  sampleTopics: string[];
}

function parseScope(value: string | null): DashboardScope {
  if (value === "news" || value === "mixed") {
    return value;
  }
  return "community";
}

function toCellKey(fromRegion: string, toRegion: string): string {
  return `${fromRegion}:${toRegion}`;
}

function uniqueSampleTopics(input: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of input) {
    const topic = (item ?? "").trim();
    if (!topic || seen.has(topic)) {
      continue;
    }
    seen.add(topic);
    output.push(topic);
    if (output.length >= 3) {
      break;
    }
  }

  return output;
}

function aggregateCells(topics: GlobalTopic[], allowedRegions: Set<string>): AggregatedCell[] {
  const bucket = new Map<string, { count: number; lagSum: number; lagCount: number; sampleTopics: string[] }>();

  for (const topic of topics) {
    const topicLabel = (topic.nameKo || topic.nameEn || "").trim();
    for (const edge of topic.propagationEdges ?? []) {
      if (!edge?.from || !edge?.to || edge.from === edge.to) {
        continue;
      }
      if (!allowedRegions.has(edge.from) || !allowedRegions.has(edge.to)) {
        continue;
      }

      const key = toCellKey(edge.from, edge.to);
      const current = bucket.get(key) ?? { count: 0, lagSum: 0, lagCount: 0, sampleTopics: [] };
      current.count += 1;
      if (Number.isFinite(edge.lagMinutes) && edge.lagMinutes > 0) {
        current.lagSum += edge.lagMinutes;
        current.lagCount += 1;
      }
      if (topicLabel) {
        current.sampleTopics.push(topicLabel);
      }
      bucket.set(key, current);
    }
  }

  return [...bucket.entries()].map(([key, value]) => {
    const [fromRegion, toRegion] = key.split(":");
    return {
      fromRegion: fromRegion ?? "",
      toRegion: toRegion ?? "",
      edgeCount: value.count,
      avgLagMinutes: value.lagCount > 0 ? value.lagSum / value.lagCount : null,
      sampleTopics: uniqueSampleTopics(value.sampleTopics),
    };
  });
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/analytics/propagation-matrix", async () => {
    const { searchParams } = new URL(request.url);
    const scope = parseScope(searchParams.get("scope"));
    const days = Math.min(Math.max(Number(searchParams.get("days") ?? 7), 1), 30);

    const orderedRegions = getAllRegions()
      .sort((left, right) => (left.sortOrder ?? 999) - (right.sortOrder ?? 999))
      .slice(0, 9)
      .map((region) => region.id);
    const allowedRegionSet = new Set(orderedRegions);
    const lagCapHours = Math.round(getSignalThreshold(scope).maxLagMinutes / 60);

    const postgres = getPostgresPoolOrNull();
    if (!postgres) {
      return NextResponse.json({
        scope,
        days,
        regions: orderedRegions,
        cells: [],
        insight: null,
        meta: {
          qualifiedCellCount: 0,
          hiddenCellCount: 0,
          lagCapHours,
        },
        configured: false,
        provider: "none",
        lastUpdated: new Date().toISOString(),
      });
    }

    const { rows } = await postgres.query<GlobalTopicRow>(
      `
      select
        id,name_en,name_ko,summary_en,summary_ko,regions,regional_sentiments,regional_heat_scores,
        topic_ids,total_heat_score,heat_score_display,first_seen_region,first_seen_at,velocity_per_hour,acceleration,spread_score,
        propagation_timeline,propagation_edges,scope,created_at
      from global_topics
      where created_at >= now() - ($1::text || ' days')::interval
        and scope = $2
      order by created_at desc, total_heat_score desc nulls last
      limit 720
      `,
      [days, scope],
    );

    const mappedTopics = rows.map(mapGlobalTopicRow);
    const qualifiedTopics = prepareQualifiedGlobalTopics(mappedTopics, scope);

    const rawCells = aggregateCells(mappedTopics, allowedRegionSet);
    const qualifiedCells = aggregateCells(qualifiedTopics, allowedRegionSet)
      .filter((cell) => cell.edgeCount >= (scope === "community" ? 2 : 1))
      .sort((left, right) => right.edgeCount - left.edgeCount || (left.avgLagMinutes ?? Number.POSITIVE_INFINITY) - (right.avgLagMinutes ?? Number.POSITIVE_INFINITY));

    const groupedByFrom = new Map<string, number>();
    for (const cell of qualifiedCells) {
      groupedByFrom.set(cell.fromRegion, (groupedByFrom.get(cell.fromRegion) ?? 0) + cell.edgeCount);
    }

    const strongest = qualifiedCells[0] ?? null;
    const insight = strongest
      ? {
          fromRegion: strongest.fromRegion,
          toRegion: strongest.toRegion,
          share:
            (strongest.edgeCount / Math.max(groupedByFrom.get(strongest.fromRegion) ?? strongest.edgeCount, 1)) * 100,
          avgLagHours:
            strongest.avgLagMinutes === null
              ? null
              : Number((strongest.avgLagMinutes / 60).toFixed(1)),
          text:
            `지난 ${days}일, ${strongest.fromRegion.toUpperCase()} 시작 이슈의 ` +
            `${Math.round(
              (strongest.edgeCount /
                Math.max(groupedByFrom.get(strongest.fromRegion) ?? strongest.edgeCount, 1)) *
                100,
            )}%가 평균 ${
              strongest.avgLagMinutes === null
                ? "-"
                : `${Math.max(0.1, strongest.avgLagMinutes / 60).toFixed(1)}h`
            } 내 ${strongest.toRegion.toUpperCase()}로 확인되었습니다.`,
        }
      : null;

    return NextResponse.json({
      scope,
      days,
      regions: orderedRegions,
      cells: qualifiedCells,
      insight,
      meta: {
        qualifiedCellCount: qualifiedCells.length,
        hiddenCellCount: Math.max(0, rawCells.length - qualifiedCells.length),
        lagCapHours,
      },
      configured: true,
      provider: "postgres",
      lastUpdated: new Date().toISOString(),
    });
  });
}
