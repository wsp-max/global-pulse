"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { RegionsApiResponse } from "@/lib/types/api";

export function useRegions() {
  return useSWR<RegionsApiResponse>("/regions", fetcher, {
    refreshInterval: 60_000,
  });
}
