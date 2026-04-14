export function LivePulseIndicator() {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
      <span className="inline-block h-3 w-3 animate-pulseBeat rounded-full bg-[var(--sentiment-positive)]" />
      Collector status: healthy · updated just now
    </div>
  );
}

