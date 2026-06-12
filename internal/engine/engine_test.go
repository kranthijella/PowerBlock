package engine

import (
	"math"
	"testing"

	"PowerBlock/internal/catalog"
)

func TestTransformersFor(t *testing.T) {
	cases := []struct {
		batteries, want int
	}{
		{-3, 0}, {0, 0}, {1, 1}, {2, 1}, {3, 2}, {4, 2}, {5, 3}, {6, 3}, {10, 5},
	}
	for _, c := range cases {
		if got := TransformersFor(c.batteries); got != c.want {
			t.Errorf("TransformersFor(%d) = %d, want %d", c.batteries, got, c.want)
		}
	}
}

func TestComputeWorkedExample(t *testing.T) {

	got := Compute(map[string]int{
		catalog.MegapackXL: 2,
		catalog.Megapack:   1,
		catalog.PowerPack:  2,
	})

	if got.BatteryCount != 5 {
		t.Errorf("BatteryCount = %d, want 5", got.BatteryCount)
	}
	if got.TransformerCount != 3 {
		t.Errorf("TransformerCount = %d, want 3", got.TransformerCount)
	}
	if got.TotalCostUSD != 340000 {
		t.Errorf("TotalCostUSD = %d, want 340000", got.TotalCostUSD)
	}
	if math.Abs(got.NetEnergyMWh-10.5) > 1e-9 {
		t.Errorf("NetEnergyMWh = %v, want 10.5", got.NetEnergyMWh)
	}
}

func TestComputeEmpty(t *testing.T) {
	got := Compute(nil)
	if got != (Totals{}) {
		t.Errorf("Compute(nil) = %+v, want zero", got)
	}
}

func TestComputeIgnoresInvalidInput(t *testing.T) {

	got := Compute(map[string]int{
		catalog.MegapackXL:  1,
		catalog.PowerPack:   0,
		catalog.Megapack2:   -2,
		"Nonexistent":       5,
		catalog.Transformer: 9,
	})

	if got.BatteryCount != 1 || got.TransformerCount != 1 {
		t.Errorf("counts = %d batteries / %d transformers, want 1/1", got.BatteryCount, got.TransformerCount)
	}
	if got.TotalCostUSD != 130000 {
		t.Errorf("TotalCostUSD = %d, want 130000", got.TotalCostUSD)
	}
	if math.Abs(got.NetEnergyMWh-3.5) > 1e-9 {
		t.Errorf("NetEnergyMWh = %v, want 3.5", got.NetEnergyMWh)
	}
}

func TestComputeTransformerEnergyCanGoNegative(t *testing.T) {

	got := Compute(map[string]int{catalog.PowerPack: 1})
	if math.Abs(got.NetEnergyMWh-0.5) > 1e-9 {
		t.Errorf("NetEnergyMWh = %v, want 0.5", got.NetEnergyMWh)
	}
}
