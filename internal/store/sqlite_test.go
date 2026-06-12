package store

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"PowerBlock/internal/catalog"
)

// newTestStore opens a fresh on-disk SQLite store in a temp dir. An on-disk file
// (not :memory:) is used so the persistence-across-reopen test is meaningful.
func newTestStore(t *testing.T) (*SQLiteStore, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s, path
}

func TestSaveAndLoadRoundTrip(t *testing.T) {
	s, _ := newTestStore(t)
	ctx := context.Background()

	want := map[string]int{catalog.MegapackXL: 2, catalog.PowerPack: 3}
	code, err := s.Save(ctx, want)
	if err != nil {
		t.Fatalf("Save: %v", err)
	}

	got, err := s.Load(ctx, code)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got.Code != code {
		t.Errorf("Code = %q, want %q", got.Code, code)
	}
	if len(got.Quantities) != len(want) {
		t.Fatalf("Quantities = %v, want %v", got.Quantities, want)
	}
	for k, v := range want {
		if got.Quantities[k] != v {
			t.Errorf("Quantities[%q] = %d, want %d", k, got.Quantities[k], v)
		}
	}
	if got.CreatedAt.IsZero() {
		t.Error("CreatedAt is zero")
	}
}

func TestLoadNotFound(t *testing.T) {
	s, _ := newTestStore(t)
	_, err := s.Load(context.Background(), "NOPEXX")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Load(unknown) error = %v, want ErrNotFound", err)
	}
}

func TestSaveGeneratesValidDistinctCodes(t *testing.T) {
	s, _ := newTestStore(t)
	ctx := context.Background()

	seen := map[string]bool{}
	for i := 0; i < 50; i++ {
		code, err := s.Save(ctx, map[string]int{catalog.Megapack: 1})
		if err != nil {
			t.Fatalf("Save: %v", err)
		}
		if len(code) != codeLength {
			t.Errorf("code %q length = %d, want %d", code, len(code), codeLength)
		}
		for _, r := range code {
			if !strings.ContainsRune(codeAlphabet, r) {
				t.Errorf("code %q contains out-of-alphabet rune %q", code, r)
			}
		}
		if seen[code] {
			t.Errorf("duplicate code generated: %q", code)
		}
		seen[code] = true
	}
}

func TestEmptyQuantitiesRoundTrip(t *testing.T) {
	s, _ := newTestStore(t)
	ctx := context.Background()
	code, err := s.Save(ctx, map[string]int{})
	if err != nil {
		t.Fatalf("Save: %v", err)
	}
	got, err := s.Load(ctx, code)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(got.Quantities) != 0 {
		t.Errorf("Quantities = %v, want empty", got.Quantities)
	}
}

// TestPersistsAcrossReopen proves the data lives on disk and would survive a
// browser cache clear: save, close, reopen the same file, and load again.
func TestPersistsAcrossReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "persist.db")
	ctx := context.Background()

	s1, err := Open(path)
	if err != nil {
		t.Fatalf("Open #1: %v", err)
	}
	code, err := s1.Save(ctx, map[string]int{catalog.Megapack2: 4})
	if err != nil {
		t.Fatalf("Save: %v", err)
	}
	if err := s1.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	s2, err := Open(path)
	if err != nil {
		t.Fatalf("Open #2: %v", err)
	}
	defer s2.Close()
	got, err := s2.Load(ctx, code)
	if err != nil {
		t.Fatalf("Load after reopen: %v", err)
	}
	if got.Quantities[catalog.Megapack2] != 4 {
		t.Errorf("after reopen Quantities = %v, want Megapack2:4", got.Quantities)
	}
}
