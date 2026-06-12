import { describe, expect, it } from "vitest";
import type { PlacedBlock } from "./api.ts";
import {
  A,
  B,
  BOX_HEIGHT,
  ISO_GAP_FT,
  project,
  sortBackToFront,
  unitFaces,
} from "./iso.ts";

describe("project", () => {
  it("maps a ground point to screen space via (fx - fy)*A, (fx + fy)*B", () => {
    // origin at (0,0): a point 30 ft right, 10 ft deep
    expect(project(30, 10)).toEqual({ x: (30 - 10) * A, y: (30 + 10) * B });
    // the origin projects to the origin
    expect(project(0, 0)).toEqual({ x: 0, y: 0 });
    // origin offset is added straight through
    expect(project(0, 0, 5, 7)).toEqual({ x: 5, y: 7 });
  });

  it("projects a footprint's corners and raises the top face by exactly H", () => {
    // a 30x10 ft unit at the origin (depth is the fixed 10 ft)
    const unit: PlacedBlock = { deviceName: "Megapack", x: 0, y: 0, w: 30, h: 10 };
    const faces = unitFaces(unit);

    // the footprint is inset by ISO_GAP_FT/2 on every side before projection, so
    // the ground front-right corner is (x+w − m, y+h − m) projected
    const m = ISO_GAP_FT / 2;
    const groundFrontRight = project(30 - m, 10 - m);
    // top face is the ground corners shifted up (−y) by the shared BOX_HEIGHT
    const topFrontRight = faces.top[2];
    expect(topFrontRight).toEqual({
      x: groundFrontRight.x,
      y: groundFrontRight.y - BOX_HEIGHT,
    });

    // the shared front vertical edge: right & left faces both touch the inset
    // ground corner (x+w−m, y+h−m)
    expect(faces.right).toContainEqual(groundFrontRight);
    expect(faces.left).toContainEqual(groundFrontRight);
  });

  it("gives every unit the same height and anchors all boxes to the ground", () => {
    // a transformer and a battery at the SAME footprint cell
    const foot = (deviceName: string): PlacedBlock => ({
      deviceName,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
    });
    const battery = unitFaces(foot("MegapackXL"));
    const transformer = unitFaces(foot("Transformer"));

    // bottom (ground) corners depend only on the footprint, not the device →
    // identical ground/bottom screen-Y, so nothing floats
    expect(transformer.right[0]).toEqual(battery.right[0]); // ground back-right
    expect(transformer.right[1]).toEqual(battery.right[1]); // ground front-right

    // shared height → tops are identical too (no shorter/floating box)
    expect(transformer.top).toEqual(battery.top);

    // top is the ground raised by exactly BOX_HEIGHT
    expect(battery.top[2].y).toBeCloseTo(battery.right[1].y - BOX_HEIGHT);
  });
});

describe("sortBackToFront", () => {
  it("orders units row-major (y then x) so nearer rows draw last", () => {
    const near: PlacedBlock = { deviceName: "PowerPack", x: 90, y: 10, w: 10, h: 10 };
    const mid: PlacedBlock = { deviceName: "Megapack", x: 30, y: 10, w: 30, h: 10 };
    const far: PlacedBlock = { deviceName: "MegapackXL", x: 0, y: 0, w: 40, h: 10 };

    const sorted = sortBackToFront([near, mid, far]);

    expect(sorted).toEqual([far, mid, near]);
    // strictly non-decreasing by (y, then x)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      expect(cur.y > prev.y || (cur.y === prev.y && cur.x >= prev.x)).toBe(true);
    }
  });

  it("draws a back-row box before a nearer-row box regardless of x", () => {
    // a transformer at the end of the back row (high x, y=0) and a battery in the
    // next row forward (low x, y=10). A plain (x+y) sort would draw the battery
    // first and the transformer ON TOP; row-major must draw the back row first.
    const backRow: PlacedBlock = { deviceName: "Transformer", x: 90, y: 0, w: 10, h: 10 };
    const frontRow: PlacedBlock = { deviceName: "Megapack2", x: 0, y: 10, w: 30, h: 10 };

    expect(sortBackToFront([frontRow, backRow])).toEqual([backRow, frontRow]);
  });

  it("does not mutate the input array", () => {
    const input: PlacedBlock[] = [
      { deviceName: "PowerPack", x: 50, y: 0, w: 10, h: 10 },
      { deviceName: "Megapack", x: 0, y: 0, w: 30, h: 10 },
    ];
    const before = [...input];
    sortBackToFront(input);
    expect(input).toEqual(before);
  });
});