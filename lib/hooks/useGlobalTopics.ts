"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { GlobalTopicsApiResponse } from "@/lib/types/api";

interface UseGlobalTopicsOptions {
  fallbackData?: GlobalTopicsApiResponse;
}

export function useGlobalTopics(limit = 10, options: UseGlobalTopicsOptions = {}) {
  const hasFallback = Boolean(options.fallbackData);

  return useSWR<GlobalTopicsApiResponse>(`/global-topics?limit=${limit}`, fetcher, {
    refreshInterval: 60_000,
    fallbackData: options.fallbackData,
    revalidateOnMount: !hasFallback,
    revalidateIfStale: !hasFallback,
  });
}


