package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"path"
	"strings"
	"time"

	"PowerBlock/internal/catalog"
	"PowerBlock/internal/engine"
	"PowerBlock/internal/store"
)

const (
	maxQtyPerDevice = 1000
	maxBodyBytes    = 64 << 10
)

// Server is the HTTP handler for the PowerBlock API and embedded frontend.
type Server struct {
	store   store.Store
	handler http.Handler
}

// New builds a Server backed by st, wiring the API routes and the embedded SPA.
func New(st store.Store) (*Server, error) {
	dist, err := frontendFS()
	if err != nil {
		return nil, fmt.Errorf("httpapi: load frontend: %w", err)
	}

	s := &Server{store: st}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/catalog", s.handleCatalog)
	mux.HandleFunc("POST /api/calculate", s.handleCalculate)
	mux.HandleFunc("POST /api/sessions", s.handleSaveSession)
	mux.HandleFunc("GET /api/sessions/{code}", s.handleLoadSession)
	mux.Handle("GET /", spaHandler(dist))

	s.handler = logging(mux)
	return s, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.handler.ServeHTTP(w, r)
}

func (s *Server) handleCatalog(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"devices": catalog.All()})
}

type quantitiesRequest struct {
	Quantities map[string]int `json:"quantities"`
}

func (s *Server) handleCalculate(w http.ResponseWriter, r *http.Request) {
	clean, ok := s.decodeAndValidate(w, r)
	if !ok {
		return
	}
	summary, lay := engine.Summarize(clean)
	writeJSON(w, http.StatusOK, map[string]any{"summary": summary, "layout": lay})
}

func (s *Server) handleSaveSession(w http.ResponseWriter, r *http.Request) {
	clean, ok := s.decodeAndValidate(w, r)
	if !ok {
		return
	}
	code, err := s.store.Save(r.Context(), clean)
	if err != nil {
		log.Printf("httpapi: save session: %v", err)
		writeError(w, http.StatusInternalServerError, "could not save session")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"code": code})
}

func (s *Server) handleLoadSession(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	sess, err := s.store.Load(r.Context(), code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	if err != nil {
		log.Printf("httpapi: load session %q: %v", code, err)
		writeError(w, http.StatusInternalServerError, "could not load session")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"code":       sess.Code,
		"quantities": sess.Quantities,
	})
}

func (s *Server) decodeAndValidate(w http.ResponseWriter, r *http.Request) (map[string]int, bool) {
	var req quantitiesRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return nil, false
	}
	clean, err := validateQuantities(req.Quantities)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return nil, false
	}
	return clean, true
}

func validateQuantities(q map[string]int) (map[string]int, error) {
	clean := make(map[string]int)
	for name, qty := range q {
		if name == catalog.Transformer {
			return nil, fmt.Errorf("transformers are auto-derived; remove %q from the request", name)
		}
		dev, ok := catalog.Get(name)
		if !ok || !dev.IsBattery {
			continue // ignore unknown / non-battery devices
		}
		if qty < 0 {
			return nil, fmt.Errorf("quantity for %q must be >= 0", name)
		}
		if qty > maxQtyPerDevice {
			return nil, fmt.Errorf("quantity for %q exceeds max of %d", name, maxQtyPerDevice)
		}
		if qty > 0 {
			clean[name] = qty
		}
	}
	return clean, nil
}

func spaHandler(dist fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(dist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clean := path.Clean(strings.TrimPrefix(r.URL.Path, "/"))
		if clean == "." || clean == "/" {
			clean = "index.html"
		}
		if _, err := fs.Stat(dist, clean); err != nil {
			r.URL.Path = "/" // unknown path → serve the SPA shell
			clean = "index.html"
		}

		if strings.HasPrefix(clean, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		fileServer.ServeHTTP(w, r)
	})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return fmt.Errorf("invalid request body: %w", err)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("httpapi: encode response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Microsecond))
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}
