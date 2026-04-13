"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelinePoint } from "@/lib/types/api";

interface HeatTrendLineProps {
  points: TimelinePoint[];
}

interface HeatChartDatum {
  timestamp: string;
  label: string;
  heatScore: number;
  sentiment: number;
  postCount: number;
}

function toChartData(points: TimelinePoint[]): HeatChartDatum[] {
  const grouped = new Map<string, TimelinePoint[]>();

  for (const point of points) {
    const key = point.recordedAt;
    const bucket = grouped.get(key) ?? [];
    bucket.push(point);
    grouped.set(key, bucket);
  }

  return [...grouped.entries()]
    .sort(
      (a, b) =>
        new Date(a[0]).getTime() - new Date(b[0]).getTime(),
    )
    .slice(-48)
    .map(([timestamp, bucket]) => {
      const heatSum = bucket.reduce((sum, item) => sum + item.heatScore, 0);
      const sentimentAvg =
        bucket.reduce((sum, item) => sum + item.sentiment, 0) / bucket.length;
      const postCountSum = bucket.reduce((sum, item) => sum + item.postCount, 0);

      const date = new Date(timestamp);
      const label = `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;

      return {
        timestamp,
        label,
        heatScore: Number(heatSum.toFixed(2)),
        sentiment: Number(sentimentAvg.toFixed(3)),
        postCount: postCountSum,
      };
    });
}

export function HeatTrendLine({ points }: HeatTrendLineProps) {
  const data = toChartData(points);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-secondary)]">
        추이 데이터가 아직 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
      <p className="mb-3 text-xs text-[var(--text-secondary)]">최근 48개 포인트 Heat Trend</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
            <defs>
              <linearGradient id="heatGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="label"
              minTickGap={24}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={{ stroke: "#334155" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={{ stroke: "#334155" }}
              width={44}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value, name) => {
                const numeric = typeof value === "number" ? value : Number(value ?? 0);
                if (name === "heatScore") return [Math.round(numeric), "Heat"];
                if (name === "sentiment") return [numeric.toFixed(2), "Sentiment"];
                return [numeric, String(name)];
              }}
            />
            <Area
              type="monotone"
              dataKey="heatScore"
              stroke="#38BDF8"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#heatGradient)"
              dot={false}
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
