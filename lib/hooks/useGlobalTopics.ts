"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { DashboardScope, GlobalTopicsApiResponse } from "@/lib/types/api";

interface UseGlobalTopicsOptions {
  fallbackData?: GlobalTopicsApiResponse;
}

export function useGlobalTopics(
  limit = 30,
  scope: DashboardScope = "community",
  options: UseGlobalTopicsOptions = {},
) {
  const hasFallback = Boolean(options.fallbackData);
  const query = `/global-topics?limit=${limit}${scope === "community" ? "" : `&scope=${scope}`}`;

  return useSWR<GlobalTopicsApiResponse>(query, fetcher, {
    refreshInterval: 60_000,
    fallbackData: options.fallbackData,
    revalidateOnMount: !hasFallback,
    revalidateIfStale: !hasFallback,
  });
}


