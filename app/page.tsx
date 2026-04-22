import { DashboardClient } from "@/components/dashboard";
import { fetchServerJson } from "@/lib/server/fetch-json";
import type { GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

export default async function HomePage() {
  const [communityRegions, newsRegions, communityGlobalTopics, newsGlobalTopics] = await Promise.all([
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=community"),
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=news"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=community&limit=30"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=news&limit=30"),
  ]);

  return (
    <DashboardClient
      initialCommunityRegions={communityRegions ?? undefined}
      initialNewsRegions={newsRegions ?? undefined}
      initialCommunityGlobalTopics={communityGlobalTopics ?? undefined}
      initialNewsGlobalTopics={newsGlobalTopics ?? undefined}
    />
  );
}
