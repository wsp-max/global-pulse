"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TopicsApiResponse } from "@/lib/types/api";

export function useTopics(regionId: string, limit = 15) {
  const query = `/topics?region=${regionId}&limit=${limit}`;
  return useSWR<TopicsApiResponse>(query, fetcher, { refreshInterval: 60_000 });
}


