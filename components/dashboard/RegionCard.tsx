import Link from "next/link";
import { HeatBadge } from "@/components/shared/HeatBadge";
import type { RegionDashboardRow } from "@/lib/types/api";
import { toHeatPercent } from "@/lib/utils/heat";

interface RegionCardProps {
  region: RegionDashboardRow;
}

export function RegionCard({ region }: RegionCardProps) {
  const heatScore = Math.round(region.totalHeatScore);
  const sentimentPercent = Math.round(((region.avgSentiment + 1) / 2) * 100);
  const heatPercent = toHeatPercent(region.totalHeatScore, 2000, 10);
  const topKeywords = region.topKeywords.slice(0, 5);

  return (
    <Link
      href={`/region/${region.id}`}
      className="block rounded-xl border border-[var(--border-default)] bg-[var(--gradient-card)] p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-hover)]"
      style={{ borderLeft: `3px solid ${region.color}` }}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">
          <span className="mr-2">{region.flagEmoji}</span>
          {region.nameKo}
        </div>
        <HeatBadge score={heatScore} />
      </div>

      <div className="mt-3 text-xs text-[var(--text-secondary)]">
        TOP: {topKeywords.length > 0 ? topKeywords.join(" / ") : "데이터 수집 중"}
      </div>

      <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-tertiary)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${heatPercent}%`,
            background: `linear-gradient(90deg, ${region.color}, var(--text-accent))`,
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
        Heat {heatScore} / 상대 강도 {heatPercent}%
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--sentiment-negative),var(--sentiment-positive))]"
          style={{ width: `${Math.max(10, sentimentPercent)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
        <span>활성 토픽 {region.activeTopics}</span>
        <span>
          소스 {region.sourcesActive}/{region.sourcesTotal}
        </span>
      </div>
    </Link>
  );
}
