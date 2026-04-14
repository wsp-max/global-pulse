interface KeywordCloudProps {
  keywords: string[];
}

export function KeywordCloud({ keywords }: KeywordCloudProps) {
  const items = keywords.filter((keyword) => keyword.trim().length > 0).slice(0, 24);

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <h2 className="text-sm font-semibold">키워드 클라우드</h2>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">아직 키워드가 생성되지 않았습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
      <h2 className="text-sm font-semibold">키워드 클라우드</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((keyword, index) => {
          const scale = 0.86 + ((items.length - index) / Math.max(items.length, 1)) * 0.4;
          return (
            <span
              key={`${keyword}-${index}`}
              className="rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1 text-xs text-[var(--text-secondary)]"
              style={{ fontSize: `${Math.min(16, 11 * scale)}px` }}
            >
              {keyword}
            </span>
          );
        })}
      </div>
    </section>
  );
}

