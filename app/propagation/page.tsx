import { PropagationPageClient } from "@/components/dashboard/PropagationPageClient";
import { fetchServerJson } from "@/lib/server/fetch-json";
import type { DashboardScope, GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PropagationPageProps {
  searchParams: Promise<{ scope?: string }>;
}

function parseScope(input: string | undefined): DashboardScope {
  if (input === "news" || input === "mixed") {
    return input;
  }
  return "community";
}

export default async function PropagationPage({ searchParams }: PropagationPageProps) {
  const { scope: rawScope } = await searchParams;
  const scope = parseScope(rawScope);

  const [regionsData, globalTopicsData] = await Promise.all([
    fetchServerJson<RegionsApiResponse>(`/api/regions?scope=${scope}`),
    fetchServerJson<GlobalTopicsApiResponse>(`/api/global-topics?scope=${scope}&limit=20`),
  ]);

  return (
    <PropagationPageClient
      scope={scope}
      initialRegions={regionsData ?? undefined}
      initialGlobalTopics={globalTopicsData ?? undefined}
    />
  );
}
