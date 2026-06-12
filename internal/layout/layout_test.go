package layout

import (
	"testing"

	"PowerBlock/internal/catalog"
)

func TestPackEmpty(t *testing.T) {
	got := Pack(nil)
	if len(got.Blocks) != 0 {
		t.Errorf("Blocks = %v, want empty", got.Blocks)
	}
	if got.Blocks == nil {
		t.Error("Blocks is nil; want non-nil empty slice for JSON []")
	}
	if got.WidthFT != 0 || got.DepthFT != 0 || got.AreaSqFt != 0 {
		t.Errorf("dimensions = %dx%d (%d sqft), want all zero", got.WidthFT, got.DepthFT, got.AreaSqFt)
	}
}

func TestPackSingleDevice(t *testing.T) {
	got := Pack(map[string]int{catalog.MegapackXL: 1})
	if len(got.Blocks) != 1 {
		t.Fatalf("got %d blocks, want 1", len(got.Blocks))
	}
	want := PlacedBlock{DeviceName: catalog.MegapackXL, X: 0, Y: 0, W: 40, H: 10}
	if got.Blocks[0] != want {
		t.Errorf("block = %+v, want %+v", got.Blocks[0], want)
	}
	if got.WidthFT != 40 || got.DepthFT != 10 || got.AreaSqFt != 400 {
		t.Errorf("dimensions = %dx%d (%d sqft), want 40x10 (400)", got.WidthFT, got.DepthFT, got.AreaSqFt)
	}
}

func TestPackFillsRowExactlyTo100(t *testing.T) {
	// 40 + 30 + 30 = 100 ft fits in a single row.
	got := Pack(map[string]int{catalog.MegapackXL: 1, catalog.Megapack2: 1, catalog.Megapack: 1})
	if got.WidthFT != 100 || got.DepthFT != 10 {
		t.Errorf("dimensions = %dx%d, want 100x10", got.WidthFT, got.DepthFT)
	}
	wantX := map[string]int{catalog.MegapackXL: 0, catalog.Megapack2: 40, catalog.Megapack: 70}
	for _, b := range got.Blocks {
		if b.Y != 0 {
			t.Errorf("%s placed on row y=%d, want single row y=0", b.DeviceName, b.Y)
		}
		if x, ok := wantX[b.DeviceName]; ok && b.X != x {
			t.Errorf("%s x=%d, want %d", b.DeviceName, b.X, x)
		}
	}
}

func TestPackWrapsToNewRow(t *testing.T) {
	// Row 0 fills to 100 (40+30+30); the extra PowerPack (10) must wrap to row 1.
	got := Pack(map[string]int{
		catalog.MegapackXL: 1, catalog.Megapack2: 1, catalog.Megapack: 1, catalog.PowerPack: 1,
	})
	if got.DepthFT != 20 {
		t.Errorf("DepthFT = %d, want 20 (two rows)", got.DepthFT)
	}
	if got.WidthFT != 100 {
		t.Errorf("WidthFT = %d, want 100", got.WidthFT)
	}
	if got.AreaSqFt != 2000 {
		t.Errorf("AreaSqFt = %d, want 2000", got.AreaSqFt)
	}
	var pp PlacedBlock
	for _, b := range got.Blocks {
		if b.DeviceName == catalog.PowerPack {
			pp = b
		}
	}
	if pp.X != 0 || pp.Y != 10 {
		t.Errorf("PowerPack at (%d,%d), want (0,10)", pp.X, pp.Y)
	}
}

func TestPackOrdersWidestFirstThenTransformer(t *testing.T) {
	got := Pack(map[string]int{catalog.PowerPack: 1, catalog.MegapackXL: 1, catalog.Transformer: 1})
	if len(got.Blocks) != 3 {
		t.Fatalf("got %d blocks, want 3", len(got.Blocks))
	}
	order := []string{got.Blocks[0].DeviceName, got.Blocks[1].DeviceName, got.Blocks[2].DeviceName}
	want := []string{catalog.MegapackXL, catalog.PowerPack, catalog.Transformer}
	for i := range want {
		if order[i] != want[i] {
			t.Errorf("block order = %v, want %v", order, want)
			break
		}
	}
}

func TestPackNeverExceedsMaxWidth(t *testing.T) {
	// Stress: a large mixed configuration must never produce a row wider than 100 ft,
	// and every block must sit fully within the bounding box.
	got := Pack(map[string]int{
		catalog.MegapackXL: 7, catalog.Megapack2: 5, catalog.Megapack: 9,
		catalog.PowerPack: 11, catalog.Transformer: 6,
	})
	if got.WidthFT > MaxWidthFT {
		t.Errorf("WidthFT = %d exceeds MaxWidthFT %d", got.WidthFT, MaxWidthFT)
	}
	// Per-row occupancy must not exceed the cap.
	rowEnd := map[int]int{}
	for _, b := range got.Blocks {
		if end := b.X + b.W; end > rowEnd[b.Y] {
			rowEnd[b.Y] = end
		}
		if b.X+b.W > MaxWidthFT {
			t.Errorf("block %+v extends past %d ft", b, MaxWidthFT)
		}
		if b.Y+b.H > got.DepthFT {
			t.Errorf("block %+v extends past site depth %d", b, got.DepthFT)
		}
	}
}

func TestPackIgnoresUnknownAndNonPositive(t *testing.T) {
	got := Pack(map[string]int{"Nope": 4, catalog.MegapackXL: 0, catalog.PowerPack: -3})
	if len(got.Blocks) != 0 || got.AreaSqFt != 0 {
		t.Errorf("Pack with no valid devices = %+v, want empty", got)
	}
}
