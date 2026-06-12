// Package layout arranges devices into a to-scale site plan. Because every device
// is the same depth (catalog.DepthFT), the site is a stack of equal-height rows
// and the problem reduces to shelf bin-packing: fill rows left-to-right without
// exceeding MaxWidthFT, wrapping to a new row when the next block won't fit.
//
// This package is purely geometric. It is handed final device counts (batteries
// plus the already-derived transformers) and knows nothing about pricing, the
// transformer rule, or energy — that lives in package engine.
package layout

import "PowerBlock/internal/catalog"

// MaxWidthFT caps the site width. The brief: "site layouts should not exceed 100ft
// in width." The widest device is 40 ft, so any single block always fits a row.
const MaxWidthFT = 100

// PlacedBlock is one device positioned on the site. Coordinates and sizes are in
// feet, origin at the top-left, x increasing right and y increasing down.
type PlacedBlock struct {
	DeviceName string `json:"deviceName"`
	X          int    `json:"x"`
	Y          int    `json:"y"`
	W          int    `json:"w"`
	H          int    `json:"h"`
}

// Layout is a packed site: the placed blocks plus the bounding-box land size.
type Layout struct {
	Blocks   []PlacedBlock `json:"blocks"`
	WidthFT  int           `json:"widthFt"`
	DepthFT  int           `json:"depthFt"`
	AreaSqFt int           `json:"areaSqFt"`
}

// Pack arranges the given device counts into rows and returns the layout with its
// bounding-box dimensions.
//
// Blocks are emitted in canonical catalog order — batteries widest-first, then the
// transformer — which packs tightly (first-fit-decreasing) and groups like devices
// visually. Unknown device names and non-positive counts are ignored. The result's
// Blocks is always non-nil so it marshals to a JSON array, not null.
func Pack(counts map[string]int) Layout {
	blocks := []PlacedBlock{}
	// rowUsed[i] is the width consumed by row i; rows are catalog.DepthFT tall.
	var rowUsed []int

	for _, dev := range catalog.All() {
		n := counts[dev.Name]
		for i := 0; i < n; i++ {
			row := firstFit(rowUsed, dev.WidthFT)
			if row == len(rowUsed) {
				rowUsed = append(rowUsed, 0)
			}
			blocks = append(blocks, PlacedBlock{
				DeviceName: dev.Name,
				X:          rowUsed[row],
				Y:          row * catalog.DepthFT,
				W:          dev.WidthFT,
				H:          dev.DepthFT,
			})
			rowUsed[row] += dev.WidthFT
		}
	}

	width := 0
	for _, used := range rowUsed {
		if used > width {
			width = used
		}
	}
	depth := len(rowUsed) * catalog.DepthFT

	return Layout{
		Blocks:   blocks,
		WidthFT:  width,
		DepthFT:  depth,
		AreaSqFt: width * depth,
	}
}

// firstFit returns the index of the first row that can take a block of the given
// width without exceeding MaxWidthFT, or len(rowUsed) to signal a new row.
func firstFit(rowUsed []int, width int) int {
	for i, used := range rowUsed {
		if used+width <= MaxWidthFT {
			return i
		}
	}
	return len(rowUsed)
}
