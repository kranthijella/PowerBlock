package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"PowerBlock/internal/catalog"
	"PowerBlock/internal/store"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	srv, err := New(st)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return srv
}

func do(t *testing.T, srv *Server, method, target string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var r *http.Request
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		r = httptest.NewRequest(method, target, bytes.NewReader(buf))
	} else {
		r = httptest.NewRequest(method, target, nil)
	}
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, r)
	return rec
}

func TestCatalog(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, http.MethodGet, "/api/catalog", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp struct {
		Devices []catalog.Device `json:"devices"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Devices) != 5 {
		t.Errorf("got %d devices, want 5", len(resp.Devices))
	}
}

func TestCalculateWorkedExample(t *testing.T) {
	srv := newTestServer(t)
	body := map[string]any{"quantities": map[string]int{
		catalog.MegapackXL: 2, catalog.Megapack: 1, catalog.PowerPack: 2,
	}}
	rec := do(t, srv, http.MethodPost, "/api/calculate", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body)
	}
	var resp struct {
		Summary struct {
			TotalCostUSD int     `json:"totalCostUsd"`
			NetEnergyMWh float64 `json:"netEnergyMwh"`
			LandAreaSqFt int     `json:"landAreaSqFt"`
		} `json:"summary"`
		Layout struct {
			Blocks []map[string]any `json:"blocks"`
		} `json:"layout"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Summary.TotalCostUSD != 340000 {
		t.Errorf("totalCostUsd = %d, want 340000", resp.Summary.TotalCostUSD)
	}
	if resp.Summary.NetEnergyMWh != 10.5 {
		t.Errorf("netEnergyMwh = %v, want 10.5", resp.Summary.NetEnergyMWh)
	}
	if resp.Summary.LandAreaSqFt != 2000 {
		t.Errorf("landAreaSqFt = %d, want 2000", resp.Summary.LandAreaSqFt)
	}
	if len(resp.Layout.Blocks) != 8 {
		t.Errorf("layout blocks = %d, want 8", len(resp.Layout.Blocks))
	}
}

func TestCalculateRejectsInvalid(t *testing.T) {
	srv := newTestServer(t)
	cases := []struct {
		name string
		body map[string]any
	}{
		{"negative", map[string]any{"quantities": map[string]int{catalog.MegapackXL: -1}}},
		{"over cap", map[string]any{"quantities": map[string]int{catalog.PowerPack: 99999}}},
		{"transformer", map[string]any{"quantities": map[string]int{catalog.Transformer: 1}}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := do(t, srv, http.MethodPost, "/api/calculate", c.body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400", rec.Code)
			}
		})
	}
}

func TestCalculateIgnoresUnknownDevice(t *testing.T) {
	srv := newTestServer(t)
	body := map[string]any{"quantities": map[string]int{"Imaginary": 3, catalog.PowerPack: 1}}
	rec := do(t, srv, http.MethodPost, "/api/calculate", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (unknown device should be ignored)", rec.Code)
	}
}

func TestSessionSaveAndResume(t *testing.T) {
	srv := newTestServer(t)
	want := map[string]int{catalog.MegapackXL: 1, catalog.Megapack2: 2}

	rec := do(t, srv, http.MethodPost, "/api/sessions", map[string]any{"quantities": want})
	if rec.Code != http.StatusCreated {
		t.Fatalf("save status = %d, want 201 (body: %s)", rec.Code, rec.Body)
	}
	var saved struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &saved); err != nil {
		t.Fatalf("decode save: %v", err)
	}
	if saved.Code == "" {
		t.Fatal("save returned empty code")
	}

	rec = do(t, srv, http.MethodGet, "/api/sessions/"+saved.Code, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("resume status = %d, want 200", rec.Code)
	}
	var loaded struct {
		Code       string         `json:"code"`
		Quantities map[string]int `json:"quantities"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &loaded); err != nil {
		t.Fatalf("decode resume: %v", err)
	}
	if loaded.Code != saved.Code {
		t.Errorf("code = %q, want %q", loaded.Code, saved.Code)
	}
	for k, v := range want {
		if loaded.Quantities[k] != v {
			t.Errorf("quantities[%q] = %d, want %d", k, loaded.Quantities[k], v)
		}
	}
}

func TestSessionNotFound(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, http.MethodGet, "/api/sessions/ZZZZZZ", nil)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestSPAServesIndexAtRootAndUnknownRoutes(t *testing.T) {
	srv := newTestServer(t)
	for _, target := range []string{"/", "/some/client/route"} {
		rec := do(t, srv, http.MethodGet, target, nil)
		if rec.Code != http.StatusOK {
			t.Errorf("GET %s status = %d, want 200", target, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "PowerBlock") {
			t.Errorf("GET %s body did not contain SPA shell", target)
		}
	}
}
