package httpapi

import (
	"embed"
	"io/fs"
)

// distFS holds the built single-page frontend. The directory is committed with a
// placeholder index.html so the server compiles from a clean checkout; the Vite
// build (Phase 7 / Makefile) overwrites it with the real assets before release.
//
//go:embed all:web/dist
var distFS embed.FS

// frontendFS returns the embedded SPA build rooted at its dist directory.
func frontendFS() (fs.FS, error) {
	return fs.Sub(distFS, "web/dist")
}
