import { useMemo } from "react";
import type { Layout } from "../types/index.ts";
import { isoBounds, sortBackToFront, unitFaces } from "../utils/iso.ts";
import { IsoBox } from "./IsoBox.tsx";

interface Props {
  layout: Layout;
}

// Render guard: the iso boxes carry far more geometry than the 2D blocks (panels,
// louvers, handles, bushings), so full decor is dropped at a lower count than the
// 2D view. Past this, units render as plain extruded boxes with just bay seams.
const ISO_DETAIL_LIMIT = 150;


export function IsoLayout({ layout }: Props) {
  const faces = useMemo(() => {
    // full detail (vents/doors/handles, fins/bushings) only while the site is sparse
    // enough for it to read; otherwise plain boxes to keep the SVG light.
    const full = layout.blocks.length <= ISO_DETAIL_LIMIT;
    return sortBackToFront(layout.blocks).map((u) => unitFaces(u, full));
  }, [layout.blocks]);
  const vb = useMemo(() => isoBounds(layout.blocks), [layout.blocks]);

  return (
    <svg
      className="site-layout__svg site-layout__svg--iso"
      viewBox={`${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Isometric site plan, ${layout.widthFt} by ${layout.depthFt} feet`}
      style={{ aspectRatio: `${vb.width} / ${vb.height}` }}
    >
      {faces.map((f, i) => (
        <IsoBox key={i} faces={f} />
      ))}
    </svg>
  );
}