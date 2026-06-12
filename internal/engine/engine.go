package engine

import (
	"PowerBlock/internal/catalog"
	"PowerBlock/internal/layout"
)

// TransformerRatio is the number of batteries per required transformer.
const TransformerRatio = 2

// Totals is the tally for a configuration: battery and derived transformer counts,
// total cost, and net energy.
type Totals struct {
	BatteryCount     int     `json:"batteryCount"`
	TransformerCount int     `json:"transformerCount"`
	TotalCostUSD     int     `json:"totalCostUsd"`
	NetEnergyMWh     float64 `json:"netEnergyMwh"`
}

// TransformersFor returns ceil(batteryCount / TransformerRatio), or 0 for no batteries.
func TransformersFor(batteryCount int) int {
	if batteryCount <= 0 {
		return 0
	}
	return (batteryCount + TransformerRatio - 1) / TransformerRatio
}

// Compute returns the totals for the given battery quantities, including the
// transformers it derives. Non-battery and non-positive entries are ignored.
func Compute(quantities map[string]int) Totals {
	var t Totals
	for name, qty := range quantities {
		if qty <= 0 {
			continue
		}
		dev, ok := catalog.Get(name)
		if !ok || !dev.IsBattery {
			continue
		}
		t.BatteryCount += qty
		t.TotalCostUSD += qty * dev.CostUSD
		t.NetEnergyMWh += float64(qty) * dev.EnergyMWh
	}

	t.TransformerCount = TransformersFor(t.BatteryCount)
	trans := catalog.TransformerDevice()
	t.TotalCostUSD += t.TransformerCount * trans.CostUSD
	t.NetEnergyMWh += float64(t.TransformerCount) * trans.EnergyMWh
	return t
}

// Summary is the Totals plus the packed land footprint and net-energy density.
type Summary struct {
	Totals
	LandWidthFT             int     `json:"landWidthFt"`
	LandDepthFT             int     `json:"landDepthFt"`
	LandAreaSqFt            int     `json:"landAreaSqFt"`
	EnergyDensityMWhPerSqFt float64 `json:"energyDensityMwhPerSqFt"`
}

// Summarize computes the totals for quantities and packs the devices into a layout,
// returning both. Energy density is zero when nothing is placed.
func Summarize(quantities map[string]int) (Summary, layout.Layout) {
	totals := Compute(quantities)
	lay := layout.Pack(deviceCounts(quantities, totals.TransformerCount))

	s := Summary{
		Totals:       totals,
		LandWidthFT:  lay.WidthFT,
		LandDepthFT:  lay.DepthFT,
		LandAreaSqFt: lay.AreaSqFt,
	}
	if lay.AreaSqFt > 0 {
		s.EnergyDensityMWhPerSqFt = totals.NetEnergyMWh / float64(lay.AreaSqFt)
	}
	return s, lay
}

func deviceCounts(quantities map[string]int, transformers int) map[string]int {
	counts := make(map[string]int)
	for name, qty := range quantities {
		if qty <= 0 {
			continue
		}
		if dev, ok := catalog.Get(name); ok && dev.IsBattery {
			counts[name] += qty
		}
	}
	if transformers > 0 {
		counts[catalog.Transformer] = transformers
	}
	return counts
}
