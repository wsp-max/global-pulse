import { getRegionById } from "@global-pulse/shared";
import type { TimelinePoint } from "@/lib/types/api";

interface TopicTimelineProps {
  points: TimelinePoint[];
  title?: string;
  emptyLabel?: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function TopicTimeline({
  points,
  title = "토픽 확산 타임라인",
  emptyLabel = "표시할 타임라인 데이터가 없습니다.",
}: TopicTimelineProps) {
  const timelineRows = [...points]
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
    .slice(0, 40);

  return (
    <section className="card-panel p-5">
      <h2 className="card-title">{title}</h2>

      {timelineRows.length === 0 ? (
        <p className="card-sub mt-2">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-3 border-l border-[var(--border-default)] pl-4">
          {timelineRows.map((point, index) => {
            const region = getRegionById(point.regionId);
            return (
              <li key={`${point.recordedAt}-${point.regionId}-${index}`} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--text-accent)]" />
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[var(--text-primary)]">
                      {region?.flagEmoji ?? "🌐"} {region?.nameKo ?? point.regionId.toUpperCase()}
                    </span>
                    <span className="text-[var(--text-tertiary)]">{formatDate(point.recordedAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{point.topicName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
                    <span>Heat {Math.round(point.heatScore)}</span>
                    <span>Sentiment {point.sentiment.toFixed(1)}</span>
                    <span>Posts {point.postCount}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
