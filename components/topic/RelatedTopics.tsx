import Link from "next/link";

export interface RelatedTopicItem {
  id: number;
  title: string;
  subtitle?: string;
  href: string;
  heatScore?: number;
}

interface RelatedTopicsProps {
  title?: string;
  items: RelatedTopicItem[];
}

export function RelatedTopics({ title = "연관 토픽", items }: RelatedTopicsProps) {
  if (items.length === 0) {
    return (
      <section className="card-panel p-5">
        <h2 className="card-title">{title}</h2>
        <p className="card-sub mt-2">연관 토픽이 아직 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="card-panel p-5">
      <h2 className="card-title">{title}</h2>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={`${item.id}-${item.href}`}>
            <Link
              href={item.href}
              className="block rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 transition-colors hover:border-[var(--border-hover)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-primary)]">{item.title}</p>
                {typeof item.heatScore === "number" ? (
                  <span className="text-[11px] text-[var(--text-tertiary)]">Heat {Math.round(item.heatScore)}</span>
                ) : null}
              </div>
              {item.subtitle ? <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{item.subtitle}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
