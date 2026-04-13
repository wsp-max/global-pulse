"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TimelineApiResponse } from "@/lib/types/api";

export function useTimeline(topicName: string | undefined, regionId?: string, hours = 24) {
  const query = topicName
    ? `/timeline?topic=${encodeURIComponent(topicName)}${regionId ? `&region=${regionId}` : ""}&hours=${hours}`
    : null;

  return useSWR<TimelineApiResponse>(query, fetcher, {
    refreshInterval: 60_000,
  });
}
