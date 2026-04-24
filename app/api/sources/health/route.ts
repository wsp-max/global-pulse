import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";
import {
  buildSourceErrorGroups,
  fetchSourceHealthRecords,
  summarizeRegionSourceHealth,
  summarizeSourceHealth,
  type SourceHealthRecord,
} from "@/lib/source-health";

function buildRegionSummary(records: SourceHealthRecord[]) {
  const byRegion = new Map<string, SourceHealthRecord[]>();
  for (const record of records) {
    const current = byRegion.get(record.regionId) ?? [];
    current.push(record);
    byRegion.set(record.regionId, current);
  }

  return [...byRegion.entries()]
    .map(([regionId, regionRows]) => summarizeRegionSourceHealth(regionId, regionRows, []))
    .sort((left, right) => left.regionId.localeCompare(right.regionId));
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/sources/health", async () => {
    const postgres = getPostgresPoolOrNull();

    if (!postgres) {
      return NextResponse.json({
        healthySources: 0,
        totalSources: 0,
        degradedSources: 0,
        autoDisabledSources24h: 0,
        degradedByCode: [],
        sourceStats: [],
        summary: {
          totalSources: 0,
          activeSources: 0,
          collectedSources24h: 0,
          collectionCoveragePct: 0,
          degradedActiveSources: 0,
          disabledSources: 0,
          autoDisabledSources: 0,
          healthySources: 0,
          staleSources: 0,
          optionalSources: 0,
          optionalHealthySources: 0,
          optionalBlockedSources: 0,
          recoveryNeededSources: 0,
        },
        regionSummary: [],
        configured: false,
        provider: "none",
        lastUpdated: new Date().toISOString(),
      });
    }

    const sourceStats = await fetchSourceHealthRecords(postgres);
    const summary = summarizeSourceHealth(sourceStats);
    const degradedByCode = buildSourceErrorGroups(sourceStats);
    const regionSummary = buildRegionSummary(sourceStats);

    return NextResponse.json({
      healthySources: summary.healthySources,
      totalSources: summary.totalSources,
      degradedSources: summary.degradedActiveSources,
      autoDisabledSources24h: summary.autoDisabledSources,
      degradedByCode,
      sourceStats,
      summary,
      regionSummary,
      configured: true,
      provider: "postgres",
      lastUpdated: new Date().toISOString(),
    });
  });
}
