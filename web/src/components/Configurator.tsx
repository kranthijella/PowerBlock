import type { Device, Quantities } from "../types/index.ts";
import { formatMwh, formatUsd } from "../utils/format.ts";

interface Props {
  batteries: Device[];
  quantities: Quantities;
  onChange: (name: string, qty: number) => void;
  onReset: () => void;
  maxQty: number;
}

// one row per battery; transformers aren't shown (the backend derives them)
export function Configurator({ batteries, quantities, onChange, onReset, maxQty }: Props) {
  return (
    <div className="configurator">
      <div className="configurator__head">
        <h2 className="panel-title">Configure your site</h2>
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          Reset
        </button>
      </div>

      <ul className="configurator__list">
        {batteries.map((d) => {
          const qty = quantities[d.name] ?? 0;
          const lineEnergy = qty * d.energyMwh;
          return (
            <li className="device-row" key={d.name}>
              <div className="device-row__info">
                <span className="device-row__name">{d.name}</span>
                <span className="device-row__meta">
                  {d.widthFt}×{d.depthFt} ft · {formatMwh(d.energyMwh)} MWh ·{" "}
                  {formatUsd(d.costUsd)}
                </span>
              </div>

              <span className="device-row__line-energy">
                {qty > 0 ? `${formatMwh(lineEnergy)} MWh` : ""}
              </span>

              <div className="device-row__qty">
                <input
                  className="qty-input"
                  type="number"
                  min={0}
                  max={maxQty}
                  value={qty}
                  aria-label={`${d.name} quantity`}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const stripped = e.target.value.replace(/^0+(?=\d)/, "");
                    if (stripped !== e.target.value) e.target.value = stripped;
                    onChange(d.name, stripped === "" ? 0 : Number(stripped));
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {batteries.length === 0 && <p className="muted">Loading catalog…</p>}
    </div>
  );
}