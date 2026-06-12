package engine

import (
	"PowerBlock/internal/catalog"
	"PowerBlock/internal/layout"
)

const TransformerRatio = 2

type Totals struct {
	BatteryCount     int     `json:"batteryCount"`
	TransformerCount int     `json:"transformerCount"`
	TotalCostUSD     int     `json:"totalCostUsd"`
	NetEnergyMWh     float64 `json:"netEnergyMwh"`
}

func TransformersFor(batteryCount int) int {
	if batteryCount <= 0 {
		return 0
	}
	return (batteryCount + TransformerRatio - 1) / TransformerRatio
}

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

type Summary struct {
	Totals
	LandWidthFT             int     `json:"landWidthFt"`
	LandDepthFT             int     `json:"landDepthFt"`
	LandAreaSqFt            int     `json:"landAreaSqFt"`
	EnergyDensityMWhPerSqFt float64 `json:"energyDensityMwhPerSqFt"`
}

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
