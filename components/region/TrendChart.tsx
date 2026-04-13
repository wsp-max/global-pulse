import type { TimelinePoint } from "@/lib/types/api";
import { HeatTrendLine } from "@/components/charts/HeatTrendLine";

interface TrendChartProps {
  points: TimelinePoint[];
}

export function TrendChart({ points }: TrendChartProps) {
  return <HeatTrendLine points={points} />;
}
