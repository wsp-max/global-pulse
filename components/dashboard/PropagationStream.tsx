import Link from "next/link";
import { useMemo } from "react";
import { getRegionById, type GlobalTopic } from "@global-pulse/shared";
import { cleanupTopicName } from "@/lib/utils/topic-name";
import type { RegionDashboardRow } from "@/lib/types/api";

interface PropagationStreamProps {
  regions: RegionDashboardRow[];
  globalTopics: GlobalTopic[];
}

interface LaneStop {
  regionId: string;
  left: number;
  firstPostAt: string;
}

interface PropagationLane {
  key: string;
  topicId?: number;
  label: string;
  isFallback: boolean;
  heat: number;
  lagText: string;
  progress: number;
  originLabel: string;
  currentLabel: string;
  stops: LaneStop[];
  velocity: number;
  acceleration: number;
}

function toTimestamp(value: string | undefined): number {
  if (!value) {
    return Number.NaN;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toLagText(start: number, end: number): string {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "same window";
  }
  const lagMinutes = Math.max(1, Math.round((end - start) / 60_000));
  if (lagMinutes < 60) {
    return `+${lagMinutes}m`;
  }
  return `+${Math.max(1, Math.round(lagMinutes / 60))}h`;
}

function buildLane(topic: GlobalTopic, index: number): PropagationLane | null {
  const timeline = (topic.propagationTimeline ?? []).filter((point) => point.firstPostAt);
  if (timeline.length < 2) {
    return null;
  }

  const first = timeline[0]!;
  const last = timeline[timeline.length - 1]!;
  const startTs = toTimestamp(first.firstPostAt);
  const endTs = toTimestamp(last.firstPostAt);
  const span = Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs ? endTs - startTs : 1;

  const cleaned = cleanupTopicName({
    id: topic.id,
    nameKo: topic.nameKo,
    nameEn: topic.nameEn,
    entities: null,
    keywords: [],
  });

  const stops: LaneStop[] = timeline.map((point) => {
    const pointTs = toTimestamp(point.firstPostAt);
    const leftRaw = Number.isFinite(pointTs) ? ((pointTs - startTs) / span) * 100 : 0;
    const left = Math.max(0, Math.min(100, Number.isFinite(leftRaw) ? leftRaw : 0));
    return {
      regionId: point.regionId,
      left,
      firstPostAt: point.firstPostAt,
    };
  });

  const originRegion = getRegionById(first.regionId);
  const currentRegion = getRegionById(last.regionId);

  return {
    key: `lane-${topic.id ?? topic.nameEn}-${index}`,
    topicId: typeof topic.id === "number" ? topic.id : undefined,
    label: cleaned.displayKo,
    isFallback: cleaned.isFallback,
    heat: topic.totalHeatScore,
    lagText: toLagText(startTs, endTs),
    progress: Math.max(...stops.map((stop) => stop.left)),
    originLabel: originRegion ? `${originRegion.flagEmoji} ${originRegion.nameKo}` : first.regionId.toUpperCase(),
    currentLabel: currentRegion ? `${currentRegion.flagEmoji} ${currentRegion.nameKo}` : last.regionId.toUpperCase(),
    stops,
    velocity: topic.velocityPerHour ?? 0,
    acceleration: topic.acceleration ?? 0,
  };
}

function buildLanes(topics: GlobalTopic[]): PropagationLane[] {
  return topics.map(buildLane).filter((lane): lane is PropagationLane => Boolean(lane)).slice(0, 8);
}

export function PropagationStream({ regions, globalTopics }: PropagationStreamProps) {
  void regions;
  const lanes = useMemo(() => buildLanes(globalTopics), [globalTopics]);
  const maxVelocity = Math.max(...lanes.map((lane) => lane.velocity), 1);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(11,24,39,0.88),rgba(10,14,23,0.98))] p-4 shadow-[var(--shadow-card)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(56,189,248,0.16),transparent_40%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-sm tracking-[0.22em] text-[var(--text-accent)]">SIGNAL PROPAGATION</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Origin → destination lanes based on propagation timeline.</p>
          </div>
          <span className="rounded-full border border-[var(--border-default)] bg-[rgba(15,23,42,0.7)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
            {lanes.length > 0 ? `Active Lanes ${lanes.length}` : "No Active Propagation"}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {lanes.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-default)] bg-[rgba(15,23,42,0.72)] p-4 text-xs text-[var(--text-secondary)]">
              No shared cross-region propagation detected in the current batch.
            </div>
          ) : (
            lanes.map((lane) => {
              const laneBody = (
                <article className="rounded-xl border border-[var(--border-default)] bg-[rgba(15,23,42,0.72)] p-3 transition-colors hover:border-[var(--border-hover)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-[var(--text-primary)]">
                      {lane.label}
                      {lane.isFallback && (
                        <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                          이름 정제 중
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[11px] text-[var(--text-secondary)]">
                      Heat {Math.round(lane.heat)} / {lane.lagText}
                    </p>
                  </div>

                  <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    {lane.originLabel} → {lane.currentLabel}
                    {(lane.acceleration > 0 && lane.velocity >= maxVelocity * 0.9) && (
                      <span className="ml-2 rounded-full border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
                        🔥 surging
                      </span>
                    )}
                  </div>

                  <div className="relative mt-2 h-5 rounded-lg border border-[var(--border-default)] bg-[rgba(10,14,23,0.82)]">
                    <div
                      className="absolute left-0 top-0 h-full rounded-lg bg-[linear-gradient(90deg,rgba(56,189,248,0.2),rgba(56,189,248,0.45))]"
                      style={{ width: `${Math.max(4, lane.progress)}%` }}
                    />

                    {lane.stops.map((stop, stopIndex) => {
                      const region = getRegionById(stop.regionId);
                      const label = region ? `${region.flagEmoji} ${region.nameKo}` : stop.regionId.toUpperCase();
                      const timeLabel = new Date(stop.firstPostAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      });

                      return (
                        <div
                          key={`${lane.key}-${stop.regionId}-${stopIndex}`}
                          className="absolute top-0 -translate-x-1/2"
                          style={{ left: `${stop.left}%` }}
                          title={`${label} ${timeLabel}`}
                        >
                          <div className="mt-0.5 h-[6px] w-[6px] rounded-full border border-[var(--bg-primary)] bg-[var(--text-accent)]" />
                          <div className="mt-1 whitespace-nowrap rounded-full border border-[var(--border-default)] bg-[rgba(15,23,42,0.9)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                            {region?.flagEmoji ?? "🌐"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );

              if (lane.topicId) {
                return (
                  <Link key={lane.key} href={`/topic/${lane.topicId}`}>
                    {laneBody}
                  </Link>
                );
              }

              return <div key={lane.key}>{laneBody}</div>;
            })
          )}
        </div>
      </div>
    </section>
  );
}
