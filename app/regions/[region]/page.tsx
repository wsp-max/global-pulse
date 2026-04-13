import { redirect } from "next/navigation";

interface RegionAliasPageProps {
  params: Promise<{ region: string }>;
}

export default async function RegionAliasPage({ params }: RegionAliasPageProps) {
  const { region } = await params;
  redirect(`/region/${region}`);
}
