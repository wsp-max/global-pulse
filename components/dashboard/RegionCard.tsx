"use client";

import { useRouter } from "next/navigation";
import { SOURCES, type Topic } from "@global-pulse/shared";
import { HeatBadge } from "@/components/shared/HeatBadge";
import { useLanguage } from "@/lib/i18n/use-language";
import type { DashboardScope, RegionDashboardRow } from "@/lib/types/api";
import { toHeatPercent } from "@/lib/utils/heat";

interface RegionCardProps {
  region: RegionDashboardRow;
  maxRegionHeatScore?: number;
  scope?: DashboardScope;
  onTopicSelect?: (topicId: number) => void;
  onToggleWatch?: (topic: Topic) => void;
  isTopicWatched?: (topicId: number | undefined) => boolean;
}

const PORTAL_SOURCE_ID_SET = new Set(
  SOURCES.filter((source) => source.type === "news" && source.newsCategory === "portal").map((source) => source.id),
);

function extractFirstSentence(summary: string | null | undefined): string {
  if (!summary) {
    return "";
  }
  const first = summary
    .split(/[.!?。！？]\s|$/u)
    .map((item) => item.trim())
    .filter(Boolean)[0];
  return first ?? "";
}

function sentimentDotColor(topic: Topic): string {
  const distribution = topic.sentimentDistribution;
  if (distribution?.controversial !== undefined && distribution.controversial > 0.35) {
    return "var(--sentiment-negative)";
  }
  if (distribution) {
    if (distribution.positive >= distribution.negative && distribution.positive >= distribution.neutral) {
      return "var(--sentiment-positive)";
    }
    if (distribution.negative >= distribution.positive && distribution.negative >= distribution.neutral) {
      return "var(--sentiment-negative)";
    }
    return "var(--sentiment-neutral)";
  }
  if ((topic.sentiment ?? 0) >= 0.2) {
    return "var(--sentiment-positive)";
  }
  if ((topic.sentiment ?? 0) <= -0.2) {
    return "var(--sentiment-negative)";
  }
  return "var(--sentiment-neutral)";
}

function buildMiniSparkline(values: number[] | null | undefined): string {
  if (!values || values.length < 2) {
    return "";
  }
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? 28 / (values.length - 1) : 28;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = 8 - (value / max) * 8;
      return `${x},${Number(y.toFixed(2))}`;
    })
    .join(" ");
}

function resolveCoverage(
  totalHeatScore: number,
  maxRegionHeatScore: number,
): { label: "Low" | "Mid" | "High"; className: string } {
  const ratio = maxRegionHeatScore > 0 ? totalHeatScore / maxRegionHeatScore : 0;
  if (ratio < 0.2) {
    return {
      label: "Low",
      className: "border-slate-500/40 text-slate-300",
    };
  }
  if (ratio < 0.6) {
    return {
      label: "Mid",
      className: "border-sky-500/40 text-sky-300",
    };
  }
  return {
    label: "High",
    className: "border-emerald-500/40 text-emerald-200",
  };
}

export function RegionCard({
  region,
  maxRegionHeatScore = 1,
  scope = "community",
  onTopicSelect,
  onToggleWatch,
  isTopicWatched,
}: RegionCardProps) {
  const { t } = useLanguage("ko");
  const router = useRouter();
  const heatScore = Math.round(region.totalHeatScore);
  const sentimentPercent = Math.round(((region.avgSentiment + 1) / 2) * 100);
  const heatPercent = toHeatPercent(region.totalHeatScore, 2000, 10);
  const topKeywords = region.topKeywords.slice(0, 5);
  const topTopics = region.topTopics.slice(0, 10);
  const extraTopicCount = Math.max(0, region.topTopics.length - 10);
  const hasPortalTrending =
    scope === "news" &&
    region.topTopics.some((topic) => topic.sourceIds.some((sourceId) => PORTAL_SOURCE_ID_SET.has(sourceId)));
  const isPartiallyStale = region.dataState === "partially-stale";
  const coverage = resolveCoverage(region.totalHeatScore, maxRegionHeatScore);

  return (
    <article
      className="block cursor-pointer rounded-xl border border-[var(--border-default)] bg-[var(--gradient-card)] p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-hover)]"
      style={{ borderLeft: `3px solid ${region.color}` }}
      role="button"
      tabIndex={0}
      aria-label={`${region.nameKo} 리전 상세 이동`}
      onClick={() => router.push(`/region/${region.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/region/${region.id}`);
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">
          <span className="mr-2">{region.flagEmoji}</span>
          {region.nameKo}
          {hasPortalTrending && (
            <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">
              📈 trending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <HeatBadge score={heatScore} />
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[10px] ${coverage.className}`}
          >
            Coverage: {coverage.label}
          </span>
        </div>
      </div>

      <div className="mt-3 text-xs text-[var(--text-secondary)]">
        TOP 키워드: {topKeywords.length > 0 ? topKeywords.join(" / ") : t("dashboard.status.collecting")}
      </div>

      <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-[var(--text-tertiary)]">
        {topTopics.length > 0 ? (
          topTopics.map((topic) => {
            const sparkline = buildMiniSparkline(topic.miniTrend ?? null);
            const watched = isTopicWatched?.(topic.id) ?? false;

            if (typeof topic.id === "number") {
              return (
                <span key={topic.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] px-2 py-0.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onTopicSelect?.(topic.id!);
                    }}
                    aria-label={`${topic.nameKo || topic.nameEn} 상세 열기`}
                  >
                    <span title={extractFirstSentence(topic.summaryKo ?? null) || undefined}>
                      {topic.nameKo || topic.nameEn}
                    </span>
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: sentimentDotColor(topic) }}
                      aria-hidden="true"
                    />
                    {topic.dominantSourceShare !== null && topic.dominantSourceShare !== undefined && topic.dominantSourceShare > 0.8 ? (
                      <span className="rounded-full border border-slate-500/40 bg-slate-500/20 px-1 text-[9px] text-slate-200">⚠️ 단일 출처</span>
                    ) : null}
                    {topic.sourceDiversity !== null && topic.sourceDiversity !== undefined && topic.sourceDiversity > 0.7 ? (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-1 text-[9px] text-emerald-200">✅ 다출처</span>
                    ) : null}
                    {sparkline ? (
                      <svg viewBox="0 0 28 8" className="h-2 w-7" aria-hidden="true">
                        <polyline points={sparkline} fill="none" stroke="var(--text-accent)" strokeWidth="1" />
                      </svg>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className={`rounded-full border px-1 text-[9px] ${
                      watched
                        ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                        : "border-[var(--border-default)] text-[var(--text-secondary)]"
                    }`}
                    aria-label={`${topic.nameKo || topic.nameEn} 워치리스트 토글`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleWatch?.(topic);
                    }}
                  >
                    🔔
                  </button>
                </span>
              );
            }

            return (
              <span key={topic.nameEn} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] px-2 py-0.5">
                <span title={extractFirstSentence(topic.summaryKo ?? null) || undefined}>
                  {topic.nameKo || topic.nameEn}
                </span>
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: sentimentDotColor(topic) }}
                  aria-hidden="true"
                />
                {topic.dominantSourceShare !== null && topic.dominantSourceShare !== undefined && topic.dominantSourceShare > 0.8 ? (
                  <span className="rounded-full border border-slate-500/40 bg-slate-500/20 px-1 text-[9px] text-slate-200">⚠️ 단일 출처</span>
                ) : null}
                {topic.sourceDiversity !== null && topic.sourceDiversity !== undefined && topic.sourceDiversity > 0.7 ? (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-1 text-[9px] text-emerald-200">✅ 다출처</span>
                ) : null}
                {sparkline ? (
                  <svg viewBox="0 0 28 8" className="h-2 w-7" aria-hidden="true">
                    <polyline points={sparkline} fill="none" stroke="var(--text-accent)" strokeWidth="1" />
                  </svg>
                ) : null}
              </span>
            );
          })
        ) : (
          <span>{t("dashboard.status.waiting")}</span>
        )}
        {extraTopicCount > 0 ? <span className="ml-1">+{extraTopicCount}</span> : null}
      </div>

      {isPartiallyStale && (
        <div className="mt-2 inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
          {t("dashboard.badge.partiallyStale")}
        </div>
      )}

      <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-tertiary)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${heatPercent}%`,
            background: `linear-gradient(90deg, ${region.color}, var(--text-accent))`,
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Heat {heatScore} / 상대 강도 {heatPercent}%</p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--sentiment-negative),var(--sentiment-positive))]"
          style={{ width: `${Math.max(10, sentimentPercent)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
        <span>활성 토픽 {region.activeTopics}</span>
        <span>
          소스 {region.sourcesActive}/{region.sourcesTotal}
        </span>
      </div>
    </article>
  );
}
