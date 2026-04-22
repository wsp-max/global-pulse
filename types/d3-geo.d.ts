declare module "d3-geo" {
  export interface GeoProjection {
    (point: [number, number]): [number, number] | null;
    translate(point: [number, number]): GeoProjection;
    scale(value: number): GeoProjection;
  }

  export function geoEqualEarth(): GeoProjection;
}
