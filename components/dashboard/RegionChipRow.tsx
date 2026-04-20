import Link from "next/link";
import type { RegionDashboardRow } from "@/lib/types/api";

const MAIN_REGION_ORDER = ["us", "cn", "jp", "kr", "eu", "in", "br", "ru"] as const;

interface RegionChipRowProps {
  regions: RegionDashboardRow[];
}

export function RegionChipRow({ regions }: RegionChipRowProps) {
  const sorted = [...regions].sort((left, right) => {
    const leftIndex = MAIN_REGION_ORDER.indexOf(left.id as (typeof MAIN_REGION_ORDER)[number]);
    const rightIndex = MAIN_REGION_ORDER.indexOf(right.id as (typeof MAIN_REGION_ORDER)[number]);
    const lp = leftIndex < 0 ? 99 : leftIndex;
    const rp = rightIndex < 0 ? 99 : rightIndex;
    if (lp !== rp) {
      return lp - rp;
    }
    return (right.totalHeatScore ?? 0) - (left.totalHeatScore ?? 0);
  });

  const active = sorted.filter((region) => (region.totalHeatScore ?? 0) > 0);

  return (
    <section className="card-panel p-0">
      <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
        <h2 className="section-title">REGION SNAPSHOT</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {active.length === 0 ? (
          <span className="text-xs text-[var(--text-secondary)]">활성 리전이 없습니다.</span>
        ) : (
          active.map((region) => (
            <Link
              key={region.id}
              href={`/region/${region.id}`}
              className="shrink-0 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            >
              {region.flagEmoji} {region.nameKo} #{region.activeTopics}
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
