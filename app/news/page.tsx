import { DashboardClient } from "@/components/dashboard";
import { fetchServerJson } from "@/lib/server/fetch-json";
import type { GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewsDashboardPage() {
  const [regionsData, globalTopicsData] = await Promise.all([
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=news"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=news&limit=60"),
  ]);

  return (
    <DashboardClient
      scope="news"
      initialRegions={regionsData ?? undefined}
      initialGlobalTopics={globalTopicsData ?? undefined}
    />
  );
}
