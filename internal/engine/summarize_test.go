package engine

import (
	"math"
	"testing"

	"PowerBlock/internal/catalog"
)

func TestSummarizeWorkedExample(t *testing.T) {

	s, lay := Summarize(map[string]int{
		catalog.MegapackXL: 2,
		catalog.Megapack:   1,
		catalog.PowerPack:  2,
	})

	if s.TotalCostUSD != 340000 {
		t.Errorf("TotalCostUSD = %d, want 340000", s.TotalCostUSD)
	}
	if math.Abs(s.NetEnergyMWh-10.5) > 1e-9 {
		t.Errorf("NetEnergyMWh = %v, want 10.5", s.NetEnergyMWh)
	}
	if s.LandWidthFT != 100 || s.LandDepthFT != 20 || s.LandAreaSqFt != 2000 {
		t.Errorf("land = %dx%d (%d sqft), want 100x20 (2000)", s.LandWidthFT, s.LandDepthFT, s.LandAreaSqFt)
	}
	if math.Abs(s.EnergyDensityMWhPerSqFt-0.00525) > 1e-9 {
		t.Errorf("EnergyDensity = %v, want 0.00525", s.EnergyDensityMWhPerSqFt)
	}
	// Layout must include all 5 batteries plus 3 transformers.
	if len(lay.Blocks) != 8 {
		t.Errorf("layout has %d blocks, want 8", len(lay.Blocks))
	}
}

func TestSummarizeEmptyHasZeroDensity(t *testing.T) {
	// No devices → zero area → density must be 0, not NaN/Inf from dividing by zero.
	s, lay := Summarize(nil)
	if s.LandAreaSqFt != 0 || s.EnergyDensityMWhPerSqFt != 0 {
		t.Errorf("empty summary = %+v, want zero land and density", s)
	}
	if len(lay.Blocks) != 0 {
		t.Errorf("layout has %d blocks, want 0", len(lay.Blocks))
	}
}

func TestSummarizeDropsUserTransformerInput(t *testing.T) {

	s, lay := Summarize(map[string]int{catalog.PowerPack: 1, catalog.Transformer: 5})
	if s.BatteryCount != 1 || s.TransformerCount != 1 {
		t.Errorf("counts = %d/%d, want 1 battery / 1 transformer", s.BatteryCount, s.TransformerCount)
	}
	if len(lay.Blocks) != 2 {
		t.Errorf("layout has %d blocks, want 2 (1 battery + 1 transformer)", len(lay.Blocks))
	}
}
