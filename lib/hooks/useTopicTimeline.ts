"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";

export interface TopicTimelineBucket {
  bucketAt: string;
  heatScore: number;
  postCount: number;
}

export interface TopicTimelineApiResponse {
  topicId: number;
  regionId: string | null;
  topicName: string | null;
  lifecycleStage: "emerging" | "peaking" | "fading";
  buckets: TopicTimelineBucket[];
  configured?: boolean;
  lastUpdated?: string;
}

export function useTopicTimeline(topicId: number | null) {
  const query = topicId ? `/topic/${topicId}/timeline` : null;
  return useSWR<TopicTimelineApiResponse>(query, fetcher, {
    refreshInterval: 60_000,
  });
}
