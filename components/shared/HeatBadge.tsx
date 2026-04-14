import { getHeatLevel } from "@global-pulse/shared";

const LEVEL_TO_COLOR: Record<string, string> = {
  cold: "var(--heat-cold)",
  warm: "var(--heat-warm)",
  hot: "var(--heat-hot)",
  fire: "var(--heat-fire)",
  explosive: "var(--heat-explosive)",
};

const LEVEL_TO_LABEL: Record<string, string> = {
  cold: "COLD",
  warm: "WARM",
  hot: "HOT",
  fire: "FIRE",
  explosive: "EXP",
};

export function HeatBadge({ score }: { score: number }) {
  const level = getHeatLevel(score);
  const label = LEVEL_TO_LABEL[level] ?? "HOT";

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: LEVEL_TO_COLOR[level] }}
    >
      {label} {score}
    </span>
  );
}

