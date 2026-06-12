

export interface DeviceStyle {
  fill: string;
  stroke: string;
}

const styles: Record<string, DeviceStyle> = {
  MegapackXL: { fill: "#F4F5F7", stroke: "#BFC6CE" }, // Tesla-cabinet white — flagship
  Megapack2: { fill: "#38BDF8", stroke: "#7DD3FC" }, // sky
  Megapack: { fill: "#A78BFA", stroke: "#C4B5FD" }, // violet
  PowerPack: { fill: "#34D399", stroke: "#6EE7B7" }, // emerald
  Transformer: { fill: "#94A3B8", stroke: "#CBD5E1" }, // slate gray
};

const fallback: DeviceStyle = { fill: "#64748b", stroke: "#94a3b8" };

export function deviceStyle(name: string): DeviceStyle {
  return styles[name] ?? fallback;
}