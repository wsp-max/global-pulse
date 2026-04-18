declare module "react-simple-maps" {
  import * as React from "react";

  interface BaseProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    [key: string]: unknown;
  }

  interface GeographiesProps extends BaseProps {
    geography: string | object;
    children?: (args: {
      geographies: Array<{
        rsmKey: string;
        [key: string]: unknown;
      }>;
    }) => React.ReactNode;
  }

  export const ComposableMap: React.ComponentType<BaseProps>;
  export const Geographies: React.ComponentType<GeographiesProps>;
  export const Geography: React.ComponentType<BaseProps>;
  export const Line: React.ComponentType<
    BaseProps & {
      from?: [number, number];
      to?: [number, number];
      coordinates?: [number, number][];
      stroke?: string;
      strokeWidth?: number;
      fill?: string;
    }
  >;
  export const Marker: React.ComponentType<BaseProps>;
}
