"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { IssueOverlapsApiResponse } from "@/lib/types/api";

export function useIssueOverlaps(limit = 60, minTier = 2) {
  const safeLimit = Math.max(1, Math.min(Math.trunc(Number.isFinite(limit) ? limit : 60), 100));
  const safeMinTier = Math.max(1, Math.min(Math.trunc(Number.isFinite(minTier) ? minTier : 2), 3));
  const query = `/issue-overlaps?limit=${safeLimit}&minTier=${safeMinTier}`;

  return useSWR<IssueOverlapsApiResponse>(query, fetcher, {
    refreshInterval: 60_000,
  });
}

