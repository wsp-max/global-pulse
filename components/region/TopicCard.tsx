import { HeatBadge } from "@/components/shared/HeatBadge";

interface TopicCardProps {
  rank: number;
  name: string;
  heatScore: number;
  heatBand: number;
  selected?: boolean;
  onClick?: () => void;
}

export function TopicCard({ rank, name, heatScore, heatBand, selected = false, onClick }: TopicCardProps) {
  const relativePercent = Math.max(8, Math.round(heatBand * 100));

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-[var(--text-accent)] bg-[var(--bg-tertiary)]"
          : "border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm">
          #{rank} {name}
        </p>
        <HeatBadge score={Math.round(heatScore)} />
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-tertiary)]">
        <div className="h-full rounded-full bg-[var(--text-accent)]" style={{ width: `${relativePercent}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
        Heat {Math.round(heatScore)} / 상대 강도 {relativePercent}%
      </p>
    </button>
  );
}
