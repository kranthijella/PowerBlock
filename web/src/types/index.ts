// Domain / API types, shared by the services layer and the components. These mirror
// the JSON the Go backend returns; they are the single shape both sides agree on.

export interface Device {
  name: string;
  widthFt: number;
  depthFt: number;
  energyMwh: number;
  costUsd: number;
  releaseYear?: number;
  isBattery: boolean;
}

export interface Summary {
  batteryCount: number;
  transformerCount: number;
  totalCostUsd: number;
  netEnergyMwh: number;
  landWidthFt: number;
  landDepthFt: number;
  landAreaSqFt: number;
  energyDensityMwhPerSqFt: number;
}

export interface PlacedBlock {
  deviceName: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  blocks: PlacedBlock[];
  widthFt: number;
  depthFt: number;
  areaSqFt: number;
}

export interface CalculateResult {
  summary: Summary;
  layout: Layout;
}

export type Quantities = Record<string, number>;