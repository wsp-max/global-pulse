import { HeatBadge } from "@/components/shared/HeatBadge";

interface TopicCardProps {
  rank: number;
  name: string;
  heatScore: number;
  selected?: boolean;
  onClick?: () => void;
}

export function TopicCard({ rank, name, heatScore, selected = false, onClick }: TopicCardProps) {
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
    </button>
  );
}
