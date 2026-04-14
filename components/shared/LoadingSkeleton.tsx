interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({ className = "", lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className={`rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 ${className}`}>
      <div className="animate-pulse space-y-2">
        {Array.from({ length: Math.max(1, lines) }).map((_, index) => (
          <div
            key={index}
            className={`h-3 rounded bg-[var(--bg-tertiary)] ${
              index === 0 ? "w-3/4" : index === lines - 1 ? "w-1/2" : "w-full"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

