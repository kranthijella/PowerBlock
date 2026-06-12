
import type { PlacedBlock } from "./api.ts";
import { deviceStyle } from "./deviceStyle.ts";

// --- tunable projection constants (viewBox units per foot / fixed px height) ---
export const A = 0.6; // horizontal spread per foot
export const B = 0.3; // vertical foreshortening per foot (A:B = 2:1 → isometric)


export const BOX_HEIGHT = 8;


export const ISO_GAP_FT = 1;

export interface Point {
  x: number;
  y: number;
}

export function project(fx: number, fy: number, originX = 0, originY = 0): Point {
  return {
    x: originX + (fx - fy) * A,
    y: originY + (fx + fy) * B,
  };
}


export function sortBackToFront(units: PlacedBlock[]): PlacedBlock[] {
  return [...units].sort((a, b) => a.y - b.y || a.x - b.x);
}

// --- colour shading -------------------------------------------------------
function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")
  );
}

// shade mixes a hex colour toward white (amt > 0) or black (amt < 0) by |amt|.
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return rgbToHex(r + (target - r) * p, g + (target - g) * p, b + (target - b) * p);
}


export const DETAIL_INK = "rgba(23, 26, 32, 0.22)";


export interface UV {
  u: number;
  v: number;
}

export interface DetailSpec {
  lines: { a: UV; b: UV }[];
  dots: UV[];
}


export function deviceDetail(deviceName: string, widthFt: number): DetailSpec {
  const lines: { a: UV; b: UV }[] = [];
  const dots: UV[] = [];

  if (deviceName === "Transformer") {
    const fins = 5;
    for (let k = 1; k <= fins; k++) {
      const u = 0.18 + (0.64 * k) / (fins + 1);
      lines.push({ a: { u, v: 0.22 }, b: { u, v: 0.78 } });
    }
    dots.push({ u: 0.4, v: 0.34 }, { u: 0.6, v: 0.34 });
  } else {
    // at least 3 bays so even the smallest battery (PowerPack, 10 ft) shows 2 lines
    const bays = Math.max(3, Math.round(widthFt / 10));
    for (let k = 1; k < bays; k++) {
      lines.push({ a: { u: k / bays, v: 0.12 }, b: { u: k / bays, v: 0.88 } });
    }
  }

  return { lines, dots };
}

const SEAM_INK = "rgba(23, 26, 32, 0.32)"; // bay seams + roof seams
const LINE_INK = "rgba(23, 26, 32, 0.26)"; // louvers, handles, radiator fins
const POST_INK = "#8b94a0"; // bushing post
const DISC_FILL = "#d6dbe1"; // bushing insulator disc
const BUSHING_H = 3; // bushing post height above the top face (viewBox units)

export interface IsoLine {
  a: Point;
  b: Point;
  stroke: string;
  w: number;
}
export interface IsoQuad {
  pts: Point[];
  fill: string;
}
export interface IsoDisc {
  c: Point;
  rx: number;
  ry: number;
  fill: string;
}

export interface UnitDecor {
  panels: IsoQuad[]; // vent + door panels (recessed shades on the wide front face)
  lines: IsoLine[]; // seams, louvers, handles, radiator fins, bushing posts
  discs: IsoDisc[]; // bushing insulator discs
}

export interface UnitFaces {
  top: Point[];
  left: Point[];
  right: Point[];
  fill: { top: string; left: string; right: string };
  stroke: string;
  decor: UnitDecor;
  unit: PlacedBlock;
}


export function unitFaces(u: PlacedBlock, full = false): UnitFaces {
  const base = deviceStyle(u.deviceName).fill;
  const isTransformer = u.deviceName === "Transformer";
  const panelFill = shade(base, -0.18); // recessed panel: a darker shade of the body

  // inset the footprint by ISO_GAP_FT/2 on every side (rendering only) so every
  // unit is separated from its neighbours on all sides. Packed size is unchanged.
  const m = ISO_GAP_FT / 2;
  const x0 = u.x + m;
  const y0 = u.y + m;
  const x1 = u.x + u.w - m;
  const y1 = u.y + u.h - m;

  // BOTTOM (ground) corners: back-left, back-right, front-right, front-left.
  const g0 = project(x0, y0);
  const g1 = project(x1, y0);
  const g2 = project(x1, y1);
  const g3 = project(x0, y1);
  // TOP corners: ground raised UP by the shared BOX_HEIGHT.
  const t0 = { x: g0.x, y: g0.y - BOX_HEIGHT };
  const t1 = { x: g1.x, y: g1.y - BOX_HEIGHT };
  const t2 = { x: g2.x, y: g2.y - BOX_HEIGHT };
  const t3 = { x: g3.x, y: g3.y - BOX_HEIGHT };

  // front (wide) face: s along width (g3→g2), h straight up
  const fAt = (s: number, h: number): Point => ({
    x: g3.x + s * (g2.x - g3.x),
    y: g3.y + s * (g2.y - g3.y) - h * BOX_HEIGHT,
  });
  // right (side / depth) face: d along depth (g1→g2), h straight up
  const rAt = (d: number, h: number): Point => ({
    x: g1.x + d * (g2.x - g1.x),
    y: g1.y + d * (g2.y - g1.y) - h * BOX_HEIGHT,
  });
  // top face: uu along width (t0→t1), vv along depth (t0→t3)
  const tAt = (uu: number, vv: number): Point => ({
    x: t0.x + uu * (t1.x - t0.x) + vv * (t3.x - t0.x),
    y: t0.y + uu * (t1.y - t0.y) + vv * (t3.y - t0.y),
  });

  const panels: IsoQuad[] = [];
  const lines: IsoLine[] = [];
  const discs: IsoDisc[] = [];

  if (isTransformer) {
    // vertical radiator fins across both visible faces
    const nf = full ? 7 : 3;
    for (let k = 1; k <= nf; k++) {
      const s = 0.12 + (0.76 * k) / (nf + 1);
      lines.push({ a: fAt(s, 0.12), b: fAt(s, 0.86), stroke: LINE_INK, w: 0.22 });
      lines.push({ a: rAt(s, 0.12), b: rAt(s, 0.86), stroke: LINE_INK, w: 0.22 });
    }
    if (full) {
      // bushings standing up from the top: a vertical post + stacked discs
      for (const uu of [0.38, 0.62]) {
        const base = tAt(uu, 0.5);
        lines.push({
          a: base,
          b: { x: base.x, y: base.y - BUSHING_H },
          stroke: POST_INK,
          w: 0.4,
        });
        for (const f of [0.5, 0.7, 0.9]) {
          discs.push({
            c: { x: base.x, y: base.y - BUSHING_H * f },
            rx: 1.1,
            ry: 0.5,
            fill: DISC_FILL,
          });
        }
      }
    }
  } else {
    // batteries: door bays across the wide (front) face
    const bays = Math.max(3, Math.round(u.w / 10));
    for (let i = 1; i < bays; i++) {
      const s = i / bays;
      lines.push({ a: fAt(s, 0), b: fAt(s, 1), stroke: SEAM_INK, w: 0.24 }); // bay seam
      lines.push({ a: tAt(s, 0), b: tAt(s, 1), stroke: SEAM_INK, w: 0.18 }); // roof seam
    }
    if (full) {
      for (let i = 0; i < bays; i++) {
        const s0 = i / bays;
        const s1 = (i + 1) / bays;
        const pad = 0.16 * (s1 - s0);
        const a = s0 + pad;
        const b = s1 - pad;
        // louvered vent panel in the upper area + 2 louver lines (skewed)
        panels.push({
          pts: [fAt(a, 0.56), fAt(b, 0.56), fAt(b, 0.82), fAt(a, 0.82)],
          fill: panelFill,
        });
        lines.push({ a: fAt(a, 0.64), b: fAt(b, 0.64), stroke: LINE_INK, w: 0.18 });
        lines.push({ a: fAt(a, 0.73), b: fAt(b, 0.73), stroke: LINE_INK, w: 0.18 });
        // door panel in the lower area + a vertical handle
        panels.push({
          pts: [fAt(a, 0.08), fAt(b, 0.08), fAt(b, 0.5), fAt(a, 0.5)],
          fill: panelFill,
        });
        const hs = s0 + (s1 - s0) * 0.72;
        lines.push({ a: fAt(hs, 0.2), b: fAt(hs, 0.36), stroke: LINE_INK, w: 0.32 });
      }
    }
  }

  return {
    top: [t0, t1, t2, t3],
    right: [g1, g2, t2, t1], // the x = x+w face (depth)
    left: [g3, g2, t2, t3], // the y = y+h face (front / width)
    fill: {
      top: shade(base, 0.22),
      left: shade(base, -0.06),
      right: shade(base, -0.3),
    },
    stroke: shade(base, -0.4),
    decor: { panels, lines, discs },
    unit: u,
  };
}

// --- view bounds ----------------------------------------------------------
export interface IsoBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}


export function isoBounds(units: PlacedBlock[], pad = 2): IsoBounds {
  if (units.length === 0) return { minX: 0, minY: 0, width: 1, height: 1 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const u of units) {
    // transformers carry bushing posts that rise above the top face
    const top = BOX_HEIGHT + (u.deviceName === "Transformer" ? BUSHING_H : 0);
    const corners = [
      project(u.x, u.y),
      project(u.x + u.w, u.y),
      project(u.x + u.w, u.y + u.h),
      project(u.x, u.y + u.h),
    ];
    for (const p of corners) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y - top); // raised top (+ bushings) above the ground
      maxY = Math.max(maxY, p.y);
    }
  }

  return {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}