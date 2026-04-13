import { getRegionById } from "@global-pulse/shared";

export function RegionFlag({ regionId }: { regionId: string }) {
  const normalizedRegionId = regionId.trim().toLowerCase();
  const region = getRegionById(normalizedRegionId);

  if (!region) {
    return <span>🌐 미확인 지역</span>;
  }

  return (
    <span>
      {region.flagEmoji} {region.nameKo}
    </span>
  );
}


