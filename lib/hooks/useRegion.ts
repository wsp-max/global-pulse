"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TopicsApiResponse } from "@/lib/types/api";

export function useRegion(regionId: string) {
  return useSWR<TopicsApiResponse>(`/topics?region=${regionId}`, fetcher, {
    refreshInterval: 60_000,
  });
}


