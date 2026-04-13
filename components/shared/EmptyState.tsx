export function EmptyState({ title = "No data" }: { title?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 text-center text-sm text-[var(--text-secondary)]">
      {title}
    </div>
  );
}


