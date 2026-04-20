import { getRegionById } from "@global-pulse/shared";
import { HeatBadge } from "@/components/shared/HeatBadge";
import type { RegionSnapshotApi } from "@/lib/types/api";

interface RegionHeaderProps {
  regionId: string;
  snapshot?: RegionSnapshotApi | null;
}

export function RegionHeader({ regionId, snapshot }: RegionHeaderProps) {
  const region = getRegionById(regionId);

  if (!region) {
    return null;
  }

  const heat = Math.round(snapshot?.total_heat_score ?? 0);
  const sentiment = snapshot?.avg_sentiment ?? 0;

  return (
    <header className="card-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {region.flagEmoji} {region.nameKo}
        </h1>
        <HeatBadge score={heat} />
      </div>
      <p className="card-sub mt-1">{region.nameEn}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-tertiary)]">
        <span>평균 감성: {sentiment.toFixed(2)}</span>
        <span>활성 토픽: {snapshot?.active_topics ?? 0}</span>
        <span>
          소스 상태: {snapshot?.sources_active ?? 0}/{snapshot?.sources_total ?? 0}
        </span>
      </div>
    </header>
  );
}
