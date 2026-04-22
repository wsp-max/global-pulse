"use client";

import useSWR from "swr";
import { getRegionById } from "@global-pulse/shared";
import { fetcher } from "@/lib/api";
import type { DashboardScope, PropagationMatrixApiResponse } from "@/lib/types/api";

interface PropagationMatrixProps {
  scope: DashboardScope;
}

function toLagLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }
  if (value < 60) {
    return `${Math.round(value)}m`;
  }
  return `${(value / 60).toFixed(1)}h`;
}

export function PropagationMatrix({ scope }: PropagationMatrixProps) {
  const { data } = useSWR<PropagationMatrixApiResponse>(
    `/analytics/propagation-matrix?scope=${scope}&days=7`,
    fetcher,
    {
      refreshInterval: 120_000,
    },
  );

  const regions = data?.regions ?? [];
  const cells = data?.cells ?? [];
  const maxCount = Math.max(1, ...cells.map((cell) => cell.edgeCount));

  const cellMap = new Map<string, (typeof cells)[number]>();
  for (const cell of cells) {
    cellMap.set(`${cell.fromRegion}:${cell.toRegion}`, cell);
  }

  return (
    <details className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4" open>
      <summary className="cursor-pointer select-none text-sm font-semibold text-[var(--text-primary)]">
        Propagation Matrix (7d)
      </summary>

      <div className="mt-2 text-xs text-[var(--text-secondary)]">
        {data?.insight?.text ?? "최근 7일 전파 인사이트를 계산하는 중입니다."}
      </div>

      {data?.meta ? (
        <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
          filtered {data.meta.hiddenCellCount} low-confidence cells · lag cap {data.meta.lagCapHours}h · qualified {data.meta.qualifiedCellCount}
        </div>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[560px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-left text-[var(--text-tertiary)]">
                from \ to
              </th>
              {regions.map((toRegion) => {
                const regionMeta = getRegionById(toRegion);
                return (
                  <th
                    key={`head-${toRegion}`}
                    className="border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-tertiary)]"
                  >
                    {regionMeta?.flagEmoji ?? "🌐"} {toRegion.toUpperCase()}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {regions.map((fromRegion) => {
              const fromMeta = getRegionById(fromRegion);
              return (
                <tr key={`row-${fromRegion}`}>
                  <th className="border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-left text-[var(--text-tertiary)]">
                    {fromMeta?.flagEmoji ?? "🌐"} {fromRegion.toUpperCase()}
                  </th>
                  {regions.map((toRegion) => {
                    const cell = cellMap.get(`${fromRegion}:${toRegion}`);
                    const count = cell?.edgeCount ?? 0;
                    const intensity = count > 0 ? Math.max(0.08, count / maxCount) : 0;
                    const bg =
                      scope === "news"
                        ? `rgba(251, 146, 60, ${intensity.toFixed(3)})`
                        : `rgba(56, 189, 248, ${intensity.toFixed(3)})`;

                    return (
                      <td
                        key={`cell-${fromRegion}-${toRegion}`}
                        className="border border-[var(--border-default)] px-2 py-1 text-center text-[var(--text-secondary)]"
                        style={{ backgroundColor: count > 0 ? bg : "transparent" }}
                        title={
                          count > 0
                            ? `count=${count}, lag=${toLagLabel(cell?.avgLagMinutes ?? null)}, topics=${
                                cell?.sampleTopics.join(" | ") || "-"
                              }`
                            : "전파 없음"
                        }
                      >
                        <div className="font-mono text-[11px] text-[var(--text-primary)]">{count > 0 ? count : "-"}</div>
                        <div className="text-[9px] text-[var(--text-tertiary)]">{toLagLabel(cell?.avgLagMinutes ?? null)}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] text-[var(--text-tertiary)]">
        셀 hover 시 최근 샘플 토픽 3개를 툴팁으로 확인할 수 있습니다.
      </div>
    </details>
  );
}
