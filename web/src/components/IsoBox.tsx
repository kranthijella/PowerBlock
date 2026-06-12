import { memo } from "react";
import type { Point, UnitFaces } from "../iso.ts";

// IsoBox draws a single unit as an extruded box: three SVG polygons (left and
// right side faces, then the top face on top) plus the device's surface markings
// on the top face. Memoized so a box only re-renders when its projected faces
// actually change — the projection itself is memoized one level up in IsoLayout.

function points(pts: Point[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

interface Props {
  faces: UnitFaces;
}

export const IsoBox = memo(function IsoBox({ faces }: Props) {
  const { unit, decor } = faces;
  return (
    <g>
      <polygon
        points={points(faces.left)}
        fill={faces.fill.left}
        stroke={faces.stroke}
        strokeWidth={0.3}
        strokeLinejoin="round"
      />
      <polygon
        points={points(faces.right)}
        fill={faces.fill.right}
        stroke={faces.stroke}
        strokeWidth={0.3}
        strokeLinejoin="round"
      />
      <polygon
        points={points(faces.top)}
        fill={faces.fill.top}
        stroke={faces.stroke}
        strokeWidth={0.3}
        strokeLinejoin="round"
      >
        <title>
          {unit.deviceName} · {unit.w}×{unit.h} ft
        </title>
      </polygon>

      {/* recessed vent / door panels on the front face */}
      {decor.panels.map((p, i) => (
        <polygon
          key={`p${i}`}
          points={points(p.pts)}
          fill={p.fill}
          stroke="rgba(23, 26, 32, 0.18)"
          strokeWidth={0.15}
          strokeLinejoin="round"
        />
      ))}

      {/* seams, louvers, handles, radiator fins, bushing posts */}
      {decor.lines.map((l, i) => (
        <line
          key={`l${i}`}
          x1={l.a.x}
          y1={l.a.y}
          x2={l.b.x}
          y2={l.b.y}
          stroke={l.stroke}
          strokeWidth={l.w}
          strokeLinecap="round"
        />
      ))}

      {/* bushing insulator discs */}
      {decor.discs.map((d, i) => (
        <ellipse
          key={`d${i}`}
          cx={d.c.x}
          cy={d.c.y}
          rx={d.rx}
          ry={d.ry}
          fill={d.fill}
          stroke="rgba(23, 26, 32, 0.25)"
          strokeWidth={0.12}
        />
      ))}
    </g>
  );
});