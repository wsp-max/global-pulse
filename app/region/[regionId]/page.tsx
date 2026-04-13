import { RegionPageClient } from "@/components/region/RegionPageClient";

interface RegionPageProps {
  params: Promise<{ regionId: string }>;
}

export default async function RegionPage({ params }: RegionPageProps) {
  const { regionId } = await params;
  return <RegionPageClient regionId={regionId} />;
}
