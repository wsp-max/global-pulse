import { DashboardClient } from "@/components/dashboard";
import { fetchServerJson } from "@/lib/server/fetch-json";
import type { GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

export default async function HomePage() {
  const [regionsData, globalTopicsData] = await Promise.all([
    fetchServerJson<RegionsApiResponse>("/api/regions"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?limit=20"),
  ]);

  return <DashboardClient initialRegions={regionsData ?? undefined} initialGlobalTopics={globalTopicsData ?? undefined} />;
}
