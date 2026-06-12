import { useMemo } from "react";
import type { Layout } from "../types/index.ts";
import { isoBounds, sortBackToFront, unitFaces } from "../utils/iso.ts";
import { IsoBox } from "./IsoBox.tsx";

interface Props {
  layout: Layout;
}

// iso boxes are heavier than 2d blocks, so drop the decor at a lower count
const ISO_DETAIL_LIMIT = 150;

export function IsoLayout({ layout }: Props) {
  const faces = useMemo(() => {
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