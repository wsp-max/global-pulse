import { getHeatLevel } from "@global-pulse/shared";

const LEVEL_TO_COLOR: Record<string, string> = {
  cold: "var(--heat-cold)",
  warm: "var(--heat-warm)",
  hot: "var(--heat-hot)",
  fire: "var(--heat-fire)",
  explosive: "var(--heat-explosive)",
};

const LEVEL_TO_ICON: Record<string, string> = {
  cold: "❄",
  warm: "🌤",
  hot: "🔥",
  fire: "🔥",
  explosive: "💥",
};

export function HeatBadge({ score }: { score: number }) {
  const level = getHeatLevel(score);
  const icon = LEVEL_TO_ICON[level] ?? "🔥";

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: LEVEL_TO_COLOR[level] }}
    >
      {icon} {score}
    </span>
  );
}


