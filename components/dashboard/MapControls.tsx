"use client";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function MapControls({ onZoomIn, onZoomOut, onReset }: MapControlsProps) {
  return (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[rgba(15,23,42,0.86)] p-1 shadow-[var(--shadow-card)]">
      <button
        type="button"
        aria-label="지도 확대"
        onClick={onZoomIn}
        className="h-7 w-7 rounded-md border border-[var(--border-default)] text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)]"
      >
        +
      </button>
      <button
        type="button"
        aria-label="지도 축소"
        onClick={onZoomOut}
        className="h-7 w-7 rounded-md border border-[var(--border-default)] text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)]"
      >
        -
      </button>
      <button
        type="button"
        aria-label="지도 리셋"
        onClick={onReset}
        className="h-7 w-7 rounded-md border border-[var(--border-default)] text-xs text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)]"
      >
        ⟳
      </button>
    </div>
  );
}
