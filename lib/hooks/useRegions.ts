"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { DashboardScope, RegionsApiResponse } from "@/lib/types/api";

interface UseRegionsOptions {
  fallbackData?: RegionsApiResponse;
}

export function useRegions(scope: DashboardScope = "community", options: UseRegionsOptions = {}) {
  const hasFallback = Boolean(options.fallbackData);
  const query = `/regions${scope === "community" ? "" : `?scope=${scope}`}`;

  return useSWR<RegionsApiResponse>(query, fetcher, {
    refreshInterval: 60_000,
    fallbackData: options.fallbackData,
    revalidateOnMount: !hasFallback,
    revalidateIfStale: !hasFallback,
  });
}
