package catalog

import "testing"

func TestAllMatchesBrief(t *testing.T) {
	// Specs lifted directly from the assignment brief; this guards against
	// accidental edits to the canonical catalog.
	want := map[string]Device{
		MegapackXL:  {Name: MegapackXL, WidthFT: 40, DepthFT: 10, EnergyMWh: 4, CostUSD: 120000, ReleaseYear: 2022, IsBattery: true},
		Megapack2:   {Name: Megapack2, WidthFT: 30, DepthFT: 10, EnergyMWh: 3, CostUSD: 80000, ReleaseYear: 2021, IsBattery: true},
		Megapack:    {Name: Megapack, WidthFT: 30, DepthFT: 10, EnergyMWh: 2, CostUSD: 50000, ReleaseYear: 2005, IsBattery: true},
		PowerPack:   {Name: PowerPack, WidthFT: 10, DepthFT: 10, EnergyMWh: 1, CostUSD: 10000, ReleaseYear: 2000, IsBattery: true},
		Transformer: {Name: Transformer, WidthFT: 10, DepthFT: 10, EnergyMWh: -0.5, CostUSD: 10000, IsBattery: false},
	}

	all := All()
	if len(all) != len(want) {
		t.Fatalf("All() returned %d devices, want %d", len(all), len(want))
	}
	for _, got := range all {
		w, ok := want[got.Name]
		if !ok {
			t.Errorf("unexpected device %q in catalog", got.Name)
			continue
		}
		if got != w {
			t.Errorf("device %q = %+v, want %+v", got.Name, got, w)
		}
	}
}

func TestAllOrderedWidestBatteriesFirstTransformerLast(t *testing.T) {
	all := All()
	// Batteries must precede the transformer, and battery widths must be
	// non-increasing — the layout packer depends on this ordering.
	seenTransformer := false
	prevWidth := 1 << 30
	for _, d := range all {
		if d.IsBattery {
			if seenTransformer {
				t.Errorf("battery %q appears after the transformer", d.Name)
			}
			if d.WidthFT > prevWidth {
				t.Errorf("battery %q width %d breaks widest-first ordering (prev %d)", d.Name, d.WidthFT, prevWidth)
			}
			prevWidth = d.WidthFT
		} else {
			seenTransformer = true
		}
	}
	last := all[len(all)-1]
	if last.Name != Transformer {
		t.Errorf("last device = %q, want Transformer", last.Name)
	}
}

func TestBatteriesExcludeTransformer(t *testing.T) {
	for _, d := range Batteries() {
		if !d.IsBattery || d.Name == Transformer {
			t.Errorf("Batteries() included non-battery %q", d.Name)
		}
	}
	if len(Batteries()) != 4 {
		t.Errorf("Batteries() returned %d, want 4", len(Batteries()))
	}
}

func TestGet(t *testing.T) {
	if d, ok := Get(MegapackXL); !ok || d.CostUSD != 120000 {
		t.Errorf("Get(MegapackXL) = %+v, %v", d, ok)
	}
	if _, ok := Get("Nonexistent"); ok {
		t.Error("Get(Nonexistent) returned ok=true")
	}
}

func TestAllReturnsCopy(t *testing.T) {
	a := All()
	a[0].CostUSD = -1
	if d, _ := Get(a[0].Name); d.CostUSD == -1 {
		t.Error("mutating All() result leaked into the catalog")
	}
}

func TestTransformerDevice(t *testing.T) {
	tr := TransformerDevice()
	if tr.Name != Transformer || tr.EnergyMWh != -0.5 || tr.IsBattery {
		t.Errorf("TransformerDevice() = %+v", tr)
	}
}
