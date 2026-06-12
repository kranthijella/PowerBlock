
WEB_DIR     := web
DIST_DIR    := internal/httpapi/web/dist
BIN         := bin/powerblock
PKG         := ./cmd/server

.DEFAULT_GOAL := run

.PHONY: run build web go-build dev test test-go test-web clean help

## run: build the frontend, then run the server on :8000
run: web
	go run $(PKG)

## build: build the frontend and compile the single binary to bin/powerblock
build: web go-build

## web: install deps and build the SPA into the Go embed dir
web:
	cd $(WEB_DIR) && npm ci && npm run build

go-build:
	CGO_ENABLED=0 go build -o $(BIN) $(PKG)

## dev: run Vite (with API proxy) and the Go server together for local development
dev:
	@echo "Starting Go API on :8000 and Vite dev server (proxying /api)…"
	@trap 'kill 0' EXIT; \
		go run $(PKG) & \
		cd $(WEB_DIR) && npm install && npm run dev; \
		wait

## test: run all backend and frontend unit tests
test: test-go test-web

test-go:
	go test ./...

## test-web: run the frontend unit tests (Vitest)
test-web:
	cd $(WEB_DIR) && npm test

## clean: remove build artifacts (keeps the committed dist placeholder)
clean:
	rm -rf $(BIN) bin
	rm -rf $(WEB_DIR)/node_modules

## help: list targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //'