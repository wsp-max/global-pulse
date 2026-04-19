import { getHeatTier, toHeatBand } from "@/lib/utils/heat";

const TIER_TO_COLOR: Record<string, string> = {
  low: "var(--heat-low)",
  mid: "var(--heat-mid)",
  high: "var(--heat-high)",
};

const TIER_TO_LABEL: Record<string, string> = {
  low: "LOW",
  mid: "MID",
  high: "HIGH",
};

export function HeatBadge({ score }: { score: number }) {
  const band = toHeatBand(score, 10_000);
  const tier = getHeatTier(band);
  const label = TIER_TO_LABEL[tier] ?? "MID";

  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: TIER_TO_COLOR[tier] }}>
      {label} {score}
    </span>
  );
}
