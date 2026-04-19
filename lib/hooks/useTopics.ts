"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TopicsApiResponse } from "@/lib/types/api";

export type TopicSort = "heat" | "recent" | "sentiment";
export type TopicPeriod = "1h" | "6h" | "24h" | "7d";

interface UseTopicsOptions {
  limit?: number;
  sort?: TopicSort;
  period?: TopicPeriod;
  fallbackData?: TopicsApiResponse;
}

export function useTopics(regionId: string, options: UseTopicsOptions = {}) {
  const limit = options.limit ?? 15;
  const sort = options.sort ?? "heat";
  const period = options.period ?? "24h";
  const hasFallback = Boolean(options.fallbackData);

  const query = `/topics?region=${regionId}&limit=${limit}&sort=${sort}&period=${period}`;
  return useSWR<TopicsApiResponse>(query, fetcher, {
    refreshInterval: 60_000,
    fallbackData: options.fallbackData,
    revalidateOnMount: !hasFallback,
    revalidateIfStale: !hasFallback,
  });
}


