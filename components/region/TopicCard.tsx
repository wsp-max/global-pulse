"use client";

import { HeatBadge } from "@/components/shared/HeatBadge";
import { useLanguage } from "@/lib/i18n/use-language";

interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
  controversial: number;
}

interface TopicCardProps {
  rank: number;
  name: string;
  heatScore: number;
  heatBand: number;
  summaryKo?: string | null;
  sentimentDistribution?: SentimentDistribution | null;
  sentiment?: number | null;
  heatTrend?: number | null;
  isFallbackName?: boolean;
  selected?: boolean;
  onClick?: () => void;
  nameRefiningLabel?: string;
}

interface SentimentBadgeSpec {
  label: string;
  colorVar: string;
}

function getWhyLine(summary: string | null | undefined): string | null {
  if (!summary) {
    return null;
  }
  const first = summary
    .split(/[.!?。！？]\s|$/u)
    .map((item) => item.trim())
    .filter(Boolean)[0];

  if (!first) {
    return null;
  }

  if (first.length <= 80) {
    return first;
  }
  return `${first.slice(0, 80).trim()}…`;
}

function resolveSentimentBadge(
  distribution: SentimentDistribution | null | undefined,
  sentiment: number | null | undefined,
): SentimentBadgeSpec {
  if (!distribution) {
    if (typeof sentiment === "number") {
      if (sentiment >= 0.2) {
        return { label: "긍정", colorVar: "var(--sentiment-positive)" };
      }
      if (sentiment <= -0.2) {
        return { label: "부정", colorVar: "var(--sentiment-negative)" };
      }
    }
    return { label: "중립", colorVar: "var(--sentiment-neutral)" };
  }

  if (distribution.controversial > 0.35) {
    return { label: "논쟁", colorVar: "var(--sentiment-negative)" };
  }

  const ranking: Array<{ label: string; value: number; colorVar: string }> = [
    { label: "긍정", value: distribution.positive, colorVar: "var(--sentiment-positive)" },
    { label: "부정", value: distribution.negative, colorVar: "var(--sentiment-negative)" },
    { label: "중립", value: distribution.neutral, colorVar: "var(--sentiment-neutral)" },
  ];

  ranking.sort((left, right) => right.value - left.value);
  return {
    label: ranking[0]?.label ?? "중립",
    colorVar: ranking[0]?.colorVar ?? "var(--sentiment-neutral)",
  };
}

export function TopicCard({
  rank,
  name,
  heatScore,
  heatBand,
  summaryKo = null,
  sentimentDistribution = null,
  sentiment = null,
  heatTrend = null,
  isFallbackName = false,
  selected = false,
  onClick,
  nameRefiningLabel,
}: TopicCardProps) {
  const { t } = useLanguage("ko");
  const relativePercent = Math.max(8, Math.round(heatBand * 100));
  const sentimentBadge = resolveSentimentBadge(sentimentDistribution, sentiment);
  const whyLine = getWhyLine(summaryKo);
  const hasTrend = typeof heatTrend === "number" && Number.isFinite(heatTrend) && Math.abs(heatTrend) >= 5;
  const trendLabel = hasTrend
    ? `${heatTrend! > 0 ? "▲" : "▼"} ${Math.round(Math.abs(heatTrend!))}%`
    : null;
  const trendClass = hasTrend
    ? heatTrend! > 0
      ? "text-emerald-400"
      : "text-rose-400"
    : "text-slate-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-[var(--text-accent)] bg-[var(--bg-tertiary)]"
          : "border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm">
          #{rank} {name}
          {isFallbackName && (
            <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
              {nameRefiningLabel ?? t("dashboard.badge.nameRefining")}
            </span>
          )}
        </p>
        <HeatBadge score={Math.round(heatScore)} />
      </div>

      {whyLine && (
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {whyLine}
        </p>
      )}

      <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-tertiary)]">
        <div className="h-full rounded-full bg-[var(--text-accent)]" style={{ width: `${relativePercent}%` }} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px]"
          style={{
            color: sentimentBadge.colorVar,
            borderColor: `${sentimentBadge.colorVar}66`,
            backgroundColor: `${sentimentBadge.colorVar}22`,
          }}
        >
          {sentimentBadge.label}
        </span>
        {trendLabel && <span className={`text-[10px] ${trendClass}`}>{trendLabel}</span>}
      </div>

      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
        Heat {Math.round(heatScore)} / 상대 강도 {relativePercent}%
      </p>
    </button>
  );
}
