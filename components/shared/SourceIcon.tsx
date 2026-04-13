export function SourceIcon({ source }: { source: string }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-1 text-[10px] uppercase text-[var(--text-secondary)]">
      {source.slice(0, 3)}
    </span>
  );
}


