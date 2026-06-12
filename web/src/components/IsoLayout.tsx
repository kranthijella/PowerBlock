import { useMemo } from "react";
import type { Layout } from "../api.ts";
import { isoBounds, sortBackToFront, unitFaces } from "../iso.ts";
import { IsoBox } from "./IsoBox.tsx";

interface Props {
  layout: Layout;
}


export function IsoLayout({ layout }: Props) {
  const faces = useMemo(
    // full detail on every unit — vents/doors/handles on all batteries,
    // fins/bushings on all transformers, regardless of size or row.
    () => sortBackToFront(layout.blocks).map((u) => unitFaces(u, true)),
    [layout.blocks],
  );
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