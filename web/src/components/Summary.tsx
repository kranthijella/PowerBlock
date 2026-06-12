import type { Summary as SummaryData } from "../api.ts";
import { formatArea, formatMwh, formatUsd } from "../format.ts";

interface Props {
  summary: SummaryData | null;
}

// Summary is the headline read-out: cost, net energy, and land size, with battery /
// transformer counts, area, and energy density as secondary chips below.
export function Summary({ summary }: Props) {
  const s = summary;
  const energyClass =
    s && s.netEnergyMwh < 0 ? "stat__value stat__value--negative" : "stat__value";

  return (
    <div className="summary">
      <div className="summary__grid">
        <div className="stat stat--primary">
          <span className="stat__label">Total cost</span>
          <span className="stat__value">{s ? formatUsd(s.totalCostUsd) : "—"}</span>
        </div>
        <div className="stat stat--primary">
          <span className="stat__label">Net energy</span>
          <span className={energyClass}>{s ? `${formatMwh(s.netEnergyMwh)} MWh` : "—"}</span>
        </div>
        <div className="stat stat--primary">
          <span className="stat__label">Land size</span>
          <span className="stat__value">
            {s ? `${s.landWidthFt}×${s.landDepthFt}` : "—"}
            {s && <span className="stat__unit"> ft</span>}
          </span>
        </div>
      </div>

      <div className="summary__secondary">
        <span className="chip">
          Batteries <strong>{s?.batteryCount ?? 0}</strong>
        </span>
        <span className="chip">
          Transformers <strong>{s?.transformerCount ?? 0}</strong>
        </span>
        <span className="chip">
          Area <strong>{s ? formatArea(s.landAreaSqFt) : "—"}</strong>
        </span>
        <span className="chip">
          Density{" "}
          <strong>{`${
              s && s.landAreaSqFt > 0
                ? (s.energyDensityMwhPerSqFt * 1000).toFixed(2)
                : "0.00"
            } MWh/k·ft²`}
          </strong>
        </span>
      </div>
    </div>
  );
}