import { PropagationPageClient } from "@/components/dashboard/PropagationPageClient";
import { fetchServerJson } from "@/lib/server/fetch-json";
import type { GlobalTopicsApiResponse, RegionsApiResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PropagationPageProps {
  searchParams: Promise<{ scope?: string }>;
}

function parseScope(input: string | undefined): "community" | "news" {
  return input === "news" ? "news" : "community";
}

export default async function PropagationPage({ searchParams }: PropagationPageProps) {
  const { scope: rawScope } = await searchParams;
  const scope = parseScope(rawScope);

  const [communityRegions, newsRegions, communityGlobalTopics, newsGlobalTopics] = await Promise.all([
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=community"),
    fetchServerJson<RegionsApiResponse>("/api/regions?scope=news"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=community&limit=180"),
    fetchServerJson<GlobalTopicsApiResponse>("/api/global-topics?scope=news&limit=90"),
  ]);

  return (
    <PropagationPageClient
      scope={scope}
      initialCommunityRegions={communityRegions ?? undefined}
      initialNewsRegions={newsRegions ?? undefined}
      initialCommunityGlobalTopics={communityGlobalTopics ?? undefined}
      initialNewsGlobalTopics={newsGlobalTopics ?? undefined}
    />
  );
}
