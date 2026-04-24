"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { SourceTransferApiResponse, SourceTransferDirection } from "@/lib/types/api";

interface UseSourceTransferParams {
  direction?: SourceTransferDirection;
  hours?: number;
  region?: string;
  limit?: number;
  offset?: number;
}

interface UseSourceTransferOptions {
  fallbackData?: SourceTransferApiResponse;
}

export function useSourceTransfer(params: UseSourceTransferParams = {}, options: UseSourceTransferOptions = {}) {
  const hasFallback = Boolean(options.fallbackData);
  const direction = params.direction ?? "community_to_news";
  const hours = Math.max(1, Math.min(Math.trunc(Number(params.hours ?? 24)), 168));
  const region = (params.region ?? "all").trim().toLowerCase() || "all";
  const limit = Math.max(1, Math.min(Math.trunc(Number(params.limit ?? 30)), 200));
  const offset = Math.max(0, Math.trunc(Number(params.offset ?? 0)));
  const query = `/analytics/source-transfer?direction=${direction}&hours=${hours}&region=${region}&limit=${limit}&offset=${offset}`;

  return useSWR<SourceTransferApiResponse>(query, fetcher, {
    refreshInterval: 60_000,
    fallbackData: options.fallbackData,
    revalidateOnMount: !hasFallback,
    revalidateIfStale: !hasFallback,
  });
}
