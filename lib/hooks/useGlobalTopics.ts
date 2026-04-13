"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { GlobalTopicsApiResponse } from "@/lib/types/api";

export function useGlobalTopics(limit = 10) {
  return useSWR<GlobalTopicsApiResponse>(`/global-topics?limit=${limit}`, fetcher, {
    refreshInterval: 60_000,
  });
}


