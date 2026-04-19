"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { DashboardScope, TopicsApiResponse } from "@/lib/types/api";

export function useRegion(regionId: string, scope: DashboardScope = "community") {
  const query = `/topics?region=${regionId}${scope === "community" ? "" : `&scope=${scope}`}`;
  return useSWR<TopicsApiResponse>(query, fetcher, {
    refreshInterval: 60_000,
  });
}


