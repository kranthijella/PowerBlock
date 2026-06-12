import { memo, useMemo, useState } from "react";
import type { Device, Layout } from "../types/index.ts";
import { deviceStyle } from "../utils/deviceStyle.ts";
import { DETAIL_INK, deviceDetail } from "../utils/iso.ts";
import { IsoLayout } from "./IsoLayout.tsx";

interface Props {
  layout: Layout | null;
  devices: Device[];
}

type View = "2d" | "iso";

const MAX_WIDTH_FT = 100; // matches layout.MaxWidthFT in the backend


// Render guard: past this many blocks the per-block surface markings (bay seams,
// fins, dots) collapse to sub-pixel noise, so we skip them and draw plain blocks.
// This keeps the layout smooth near the input ceiling (4 types × 1000 ≈ 6k blocks)
// while still showing every unit to scale.
const DETAIL_BLOCK_LIMIT = 400;


// Memoized: the layout holds up to a few thousand blocks, and its props (layout,
// devices) don't change while the user is typing in the configurator — only after the
// debounced recalculation returns. Without this, every keystroke re-rendered and
// rebuilt the whole SVG block list with identical data.
export const SiteLayout = memo(function SiteLayout({ layout, devices }: Props) {
  // Default to 2D so the original to-scale view stays the landing state.
  const [view, setView] = useState<View>("2d");
  const hasBlocks = layout && layout.blocks.length > 0;
  const depth = hasBlocks ? layout.depthFt : 10;
  const showDetail = hasBlocks && layout.blocks.length <= DETAIL_BLOCK_LIMIT;

  // Which device types are actually placed, for the legend (in catalog order). Memoized
  // so the O(n) Set build over the blocks doesn't run on unrelated re-renders.
  const legend = useMemo(() => {
    const present = new Set(layout?.blocks.map((b) => b.deviceName) ?? []);
    return devices.filter((d) => present.has(d.name));
  }, [layout, devices]);

  return (
    <div className="site-layout">
      <div className="site-layout__head">
        <h2 className="panel-title">Site layout</h2>
        {hasBlocks && (
          <div
            className="site-layout__toggle"
            role="group"
            aria-label="Layout view"
          >
            <button
              type="button"
              className="site-layout__toggle-btn"
              aria-pressed={view === "2d"}
              onClick={() => setView("2d")}
            >
              2D
            </button>
            <button
              type="button"
              className="site-layout__toggle-btn"
              aria-pressed={view === "iso"}
              onClick={() => setView("iso")}
            >
              Isometric
            </button>
          </div>
        )}
      </div>

      {!hasBlocks ? (
        <p className="site-layout__empty">
          Add batteries to see the to-scale site plan.
        </p>
      ) : view === "iso" ? (
        <IsoLayout layout={layout} />
      ) : (
        <svg
          className="site-layout__svg"
          viewBox={`0 0 ${MAX_WIDTH_FT} ${depth}`}
          preserveAspectRatio="xMidYMin meet"
          role="img"
          aria-label={`Site plan, ${layout.widthFt} by ${layout.depthFt} feet`}
          style={{ aspectRatio: `${MAX_WIDTH_FT} / ${depth}` }}
        >
          {layout.blocks.map((b, i) => {
            const style = deviceStyle(b.deviceName);
            // device surface detail, mapped from fractional (u,v) onto the inset rect
            const ix = b.x + 0.4;
            const iy = b.y + 0.4;
            const iw = b.w - 0.8;
            const ih = b.h - 0.8;
            // skip the per-block markings entirely once the site is dense (guard)
            const detail = showDetail ? deviceDetail(b.deviceName, b.w) : null;
            return (
              <g key={i}>
                <rect
                  x={ix}
                  y={iy}
                  width={iw}
                  height={ih}
                  rx={0.8}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={0.3}
                >
                  <title>
                    {b.deviceName} · {b.w}×{b.h} ft
                  </title>
                </rect>
                {detail?.lines.map((l, j) => (
                  <line
                    key={`l${j}`}
                    x1={ix + l.a.u * iw}
                    y1={iy + l.a.v * ih}
                    x2={ix + l.b.u * iw}
                    y2={iy + l.b.v * ih}
                    stroke={DETAIL_INK}
                    strokeWidth={0.25}
                    strokeLinecap="round"
                  />
                ))}
                {detail?.dots.map((d, j) => (
                  <circle
                    key={`d${j}`}
                    cx={ix + d.u * iw}
                    cy={iy + d.v * ih}
                    r={0.8}
                    fill={DETAIL_INK}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      )}

      {legend.length > 0 && (
        <ul className="site-layout__legend">
          {legend.map((d) => (
            <li key={d.name} className="legend-item">
              <span
                className="legend-item__swatch"
                style={{ background: deviceStyle(d.name).fill }}
              />
              {d.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
