"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { RegionsApiResponse } from "@/lib/types/api";

interface UseRegionsOptions {
  fallbackData?: RegionsApiResponse;
}

export function useRegions(options: UseRegionsOptions = {}) {
  const hasFallback = Boolean(options.fallbackData);

  return useSWR<RegionsApiResponse>("/regions", fetcher, {
    refreshInterval: 60_000,
    fallbackData: options.fallbackData,
    revalidateOnMount: !hasFallback,
    revalidateIfStale: !hasFallback,
  });
}
