import { getRegionById } from "@global-pulse/shared";

export function RegionFlag({ regionId }: { regionId: string }) {
  const region = getRegionById(regionId);

  if (!region) {
    return <span>?? Unknown</span>;
  }

  return (
    <span>
      {region.flagEmoji} {region.nameKo}
    </span>
  );
}


