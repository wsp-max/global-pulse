"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TopicDetailApiResponse } from "@/lib/types/api";

export function useTopicDetail(topicId: string) {
  const query = topicId ? `/topic/${encodeURIComponent(topicId)}` : null;
  return useSWR<TopicDetailApiResponse>(query, fetcher, {
    refreshInterval: 60_000,
  });
}
