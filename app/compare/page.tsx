import { DualCompareClient } from "@/components/dashboard";
import { fetchServerJson } from "@/lib/server/fetch-json";
import type {
  GlobalTopicsApiResponse,
  RegionsApiResponse,
} from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ComparePage() {
  const [communityRegions, newsRegions, communityGlobal, newsGlobal] = await Promise.all([
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=community"),
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=news"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=community&limit=60"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=news&limit=60"),
  ]);

  return (
    <DualCompareClient
      initialCommunityRegions={communityRegions ?? undefined}
      initialNewsRegions={newsRegions ?? undefined}
      initialCommunityGlobalTopics={communityGlobal ?? undefined}
      initialNewsGlobalTopics={newsGlobal ?? undefined}
    />
  );
}
