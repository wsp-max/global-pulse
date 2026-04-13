import Link from "next/link";
import { REGIONS } from "@global-pulse/shared";

export function Sidebar() {
  return (
    <aside className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
      <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Regions</p>
      <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
        {REGIONS.map((region) => (
          <li key={region.id}>
            <Link href={`/region/${region.id}`} className="block rounded-md px-2 py-1 hover:bg-[var(--bg-tertiary)]">
              <span className="mr-2">{region.flagEmoji}</span>
              {region.nameKo}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}


