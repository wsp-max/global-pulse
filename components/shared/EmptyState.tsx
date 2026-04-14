interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function EmptyState({
  title = "No data",
  description,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 text-center ${className}`}
    >
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      {description && <p className="mt-2 text-xs text-[var(--text-secondary)]">{description}</p>}
    </div>
  );
}

