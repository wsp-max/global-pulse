interface RegionRiseItem {
  regionId: string;
  regionName: string;
  flagEmoji: string;
  topTopicName: string;
  heatScore: number;
}

interface RegionRiseListProps {
  items: RegionRiseItem[];
}

export function RegionRiseList({ items }: RegionRiseListProps) {
  return (
    <section>
      <h2 className="section-title">REGION RISE TOP 10</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--text-secondary)]">리전 상승 데이터를 집계 중입니다.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.regionId}-${index}`}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--text-primary)]">
                  {item.flagEmoji} {item.regionName}
                </p>
                <span className="meta-xs">Heat {Math.round(item.heatScore)}</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)] line-clamp-1">{item.topTopicName}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
