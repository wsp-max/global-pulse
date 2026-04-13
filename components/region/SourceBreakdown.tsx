interface SourceBreakdownProps {
  sourceIds: string[];
}

export function SourceBreakdown({ sourceIds }: SourceBreakdownProps) {
  if (sourceIds.length === 0) {
    return <div className="text-xs text-[var(--text-secondary)]">출처 데이터가 없습니다.</div>;
  }

  const ratio = Math.round(100 / sourceIds.length);

  return (
    <div className="space-y-2">
      {sourceIds.map((source) => (
        <div key={source} className="text-xs text-[var(--text-secondary)]">
          <div className="mb-1 flex items-center justify-between">
            <span>{source}</span>
            <span>{ratio}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-tertiary)]">
            <div className="h-full rounded-full bg-[var(--text-accent)]" style={{ width: `${ratio}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
