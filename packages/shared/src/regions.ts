import type { Region } from "./types";
import { REGIONS } from "./constants";

export const REGION_MAP: Record<string, Region> = Object.fromEntries(
  REGIONS.map((region) => [
    region.id,
    {
      id: region.id,
      nameKo: region.nameKo,
      nameEn: region.nameEn,
      flagEmoji: region.flagEmoji,
      timezone: region.timezone,
      color: region.color,
      isActive: true,
      sortOrder: region.sortOrder,
    },
  ]),
);

export function getRegionById(regionId: string): Region | null {
  return REGION_MAP[regionId] ?? null;
}

export function getAllRegions(): Region[] {
  return Object.values(REGION_MAP).sort(
    (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
  );
}

