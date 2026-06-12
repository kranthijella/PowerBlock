# PowerBlock

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?logo=docker&logoColor=white)
![Deployed on Fly.io](https://img.shields.io/badge/deploy-Fly.io-8B5CF6)

PowerBlock is a browser tool for planning an industrial energy battery site. You pick
how many of each battery you want. The app adds the transformers those batteries
require, then reports the total cost, the land size, and the net energy, and draws a
to-scale layout of the site capped at 100 ft wide. You can also save a configuration
and reopen it later from a shareable link, even after clearing your browser cache,
because the state lives on the server rather than in `localStorage`.

In other words, it produces both a bill of materials (the parts and totals) and a site
layout (where the blocks actually sit) from the same set of quantities.

> **Live demo:** <https://powerblock.fly.dev/>
> **Repository:** <https://github.com/kranthijella/PowerBlock>

![PowerBlock UI](docs/img.png)

---

## Table of contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Domain model](#domain-model)
- [Computation spec](#computation-spec)
- [Layout packing algorithm](#layout-packing-algorithm)
- [HTTP API reference](#http-api-reference)
- [Persistence and share codes](#persistence-and-share-codes)
- [Frontend](#frontend)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Design decisions and assumptions](#design-decisions-and-assumptions)

---

## Quick start

One command, one port. A single Go binary serves the JSON API and the compiled
frontend together on `http://localhost:8000`.

```bash
make run            # builds the SPA, embeds it, runs the server on :8000
# or
docker compose up   # identical, in a container; saved sessions persist in a volume
```

Then open <http://localhost:8000>.

### Everyday commands

| Command | What it does |
|---------|--------------|
| `make run` | Build the frontend, then run the server on `:8000`. |
| `make build` | Produce a single static binary at `./bin/powerblock` with the SPA embedded. |
| `make dev` | Vite dev server (hot reload) plus the Go API; `/api` is proxied to `:8000`. |
| `make test` | All backend (`go test ./...`) and frontend (Vitest) unit tests. |
| `make clean` | Remove build artifacts and `node_modules`. |
| `make help` | List every target. |

To build locally you need Go 1.26+ and Node 20.19+/22.12+. With Docker you need
neither, since the multi-stage image builds the frontend and compiles the binary for
you.

---

## Architecture

The backend is a layered Go service. All of the domain logic lives there, and the
React client only renders what the backend computes. There is one source of truth for
the catalog, the pricing, and the math, so the frontend never has its own copy of a
number that could drift.

```
Browser  ·  React + TypeScript + SCSS, built by Vite
   │  Configurator · live Summary · to-scale SVG layout · save/resume bar
   │
   │  fetch JSON over HTTP   (the client holds no business logic)
   ▼
cmd/server  ·  one static binary on :8000
   │
   └─ internal/httpapi   JSON API + embedded SPA + input validation
         ├─ internal/engine     cost · net energy · transformer rule
         │     └─ internal/layout    shelf-pack into 10-ft rows, ≤ 100 ft
         │           └─ internal/catalog   device source of truth
         └─ internal/store      Store interface → SQLite (pure-Go)
```

Dependencies point one way: `httpapi → engine → layout → catalog`, plus
`httpapi → store`. The client depends on the API, the API depends on the engine, and
the engine depends on the catalog. There are no cycles and no business logic sitting
above the Go layer.

| Layer | Tech | Responsibility |
|-------|------|----------------|
| Catalog (`internal/catalog`) | Go stdlib | The source of truth for devices: footprint, energy, cost, release year. Immutable; callers get copies. |
| Engine (`internal/engine`) | Go stdlib | Cost, net energy, the auto-derived transformer rule, and the `Summary` (totals plus land size and energy density). |
| Layout (`internal/layout`) | Go stdlib | Shelf-packs devices into 10-ft rows, wraps at 100 ft, returns placed blocks and the bounding box. |
| Store (`internal/store`) | `database/sql` + pure-Go SQLite | A `Store` interface for server-side save/resume by short share code. Swappable for Postgres. |
| HTTP API (`internal/httpapi`) | `net/http` (Go 1.22+ routing) | JSON endpoints, input validation, and serving the `go:embed`-ed SPA. |
| Frontend (`web/`) | React 19 + TypeScript + SCSS (Vite 8) | Configurator, live summary, to-scale layout, save/resume. Presentation only. |

The SPA is built into `internal/httpapi/web/dist` and embedded into the binary with
`go:embed`. Production is therefore a single self-contained executable on one port,
with no separate web server or static-asset host to run.

---

## Project layout

```
PowerBlock/
├── cmd/server/main.go          # entrypoint: env config, store, server, graceful shutdown
├── internal/
│   ├── catalog/                # device source of truth (+ tests)
│   ├── engine/                 # cost / energy / transformer math, Summarize (+ tests)
│   ├── layout/                 # shelf-packing algorithm (+ edge-case tests)
│   ├── store/                  # Store interface + SQLite implementation (+ tests)
│   └── httpapi/                # routes, validation, embedded SPA (+ tests)
│       └── web/dist/           # build output, go:embed-ed into the binary
├── web/                        # React + TS + SCSS frontend (Vite)
│   └── src/
│       ├── App.tsx             # state, data fetching, URL save/resume
│       ├── api.ts              # typed API client (mirrors backend JSON)
│       ├── components/         # Configurator, Summary, SiteLayout, SessionBar
│       └── icons/              # original SVG device icons
├── Dockerfile                  # 3-stage: build SPA → compile Go → distroless runtime
├── docker-compose.yml          # one-command run, named volume for the DB
├── fly.toml                    # Fly.io deploy config (volume, scale-to-zero)
└── Makefile                    # run / build / dev / test
```

---

## Domain model

There are four selectable batteries. The Transformer is a support device that the
engine adds automatically; users never select it directly.

| Device | Footprint | Energy | Cost | Released |
|--------|-----------|--------|------|----------|
| MegapackXL | 40 × 10 ft | +4 MWh | $120,000 | 2022 |
| Megapack2 | 30 × 10 ft | +3 MWh | $80,000 | 2021 |
| Megapack | 30 × 10 ft | +2 MWh | $50,000 | 2005 |
| PowerPack | 10 × 10 ft | +1 MWh | $10,000 | 2000 |
| Transformer | 10 × 10 ft | −0.5 MWh | $10,000 | — |

Every device is 10 ft deep, so only the width varies. That is what makes the site
layout a shelf-packing problem: fill rows that are 10 ft tall and at most 100 ft wide.

The catalog lives in `internal/catalog/catalog.go` and is exposed through `All()`,
`Batteries()`, `Get(name)`, and `TransformerDevice()`. It is the only place these
numbers are defined, and the API hands them to the client via `GET /api/catalog`.

---

## Computation spec

```
batteryCount = Σ battery quantities
transformers = ceil(batteryCount / 2)              # auto-derived, never user input
totalCost    = Σ(qty × cost) + transformers × $10,000
netEnergy    = Σ(qty × MWh)  − transformers × 0.5 MWh
landSize     = bounding box of the packed layout (width × depth, width ≤ 100 ft)
```

Transformers count fully: they add to the cost and they subtract from the net energy.
The ratio is integer ceiling division, implemented in `engine.TransformersFor`:

```go
transformers = (batteryCount + 1) / 2   // ceil(n/2) without floating point
```

### Worked example

Input: 2× MegapackXL, 1× Megapack, 2× PowerPack

| Step | Result |
|------|--------|
| batteryCount | 2 + 1 + 2 = 5 |
| transformers | ceil(5 / 2) = 3 |
| totalCost | 2·120,000 + 1·50,000 + 2·10,000 + 3·10,000 = $340,000 |
| netEnergy | (8 + 2 + 2) − (3 · 0.5) = 10.5 MWh |
| landSize | 100 × 20 ft (two 10-ft rows) |

---

## Layout packing algorithm

`layout.Pack` (`internal/layout/layout.go`) arranges devices with a single first-fit
shelf-packing pass:

1. Walk the devices in canonical catalog order, widest battery first and transformer
   last, so the big blocks anchor each row and the small ones fill the gaps.
2. Place each unit in the first row whose used width leaves room without exceeding
   `MaxWidthFT` (100 ft). If no row fits, start a new one below.
3. Each row is `DepthFT` (10 ft) tall, and rows stack downward (`y = rowIndex × 10`).
4. Land size is the bounding box: width is the widest used row, depth is the number of
   rows times 10 ft, and area is width times depth.

Each placed block comes back with its `{x, y, w, h}` in feet, which is what lets the
frontend draw the site to scale in SVG. The widest device is 40 ft, so a single block
always fits inside a 100-ft row and the cap can never strand a unit.

Edge cases (zero quantities, a single oversized count, exact-fit rows, and wrapping
right at the boundary) are covered in `internal/layout/layout_test.go`.

---

## HTTP API reference

The UI itself shows only real numbers and a visual layout, never raw JSON. Underneath,
it talks to a small JSON API. Every endpoint uses the Go 1.22+ method-aware router,
request bodies are capped at 64 KiB, and unknown fields are rejected.

| Method and path | Purpose |
|---------------|---------|
| `GET /api/catalog` | Returns the full device catalog. |
| `POST /api/calculate` | Takes `{ quantities }`, returns `{ summary, layout }`. |
| `POST /api/sessions` | Takes `{ quantities }`, returns `{ code }` saved server-side. |
| `GET /api/sessions/{code}` | Resume a saved configuration. |
| `GET /*` | The embedded SPA. Any unknown path serves the app shell. |

### `GET /api/catalog`

```json
{
  "devices": [
    { "name": "MegapackXL", "widthFt": 40, "depthFt": 10, "energyMwh": 4,
      "costUsd": 120000, "releaseYear": 2022, "isBattery": true },
    { "name": "Transformer", "widthFt": 10, "depthFt": 10, "energyMwh": -0.5,
      "costUsd": 10000, "isBattery": false }
  ]
}
```

### `POST /api/calculate`

```bash
curl -s localhost:8000/api/calculate \
  -H 'Content-Type: application/json' \
  -d '{"quantities":{"MegapackXL":2,"Megapack":1,"PowerPack":2}}'
```

```json
{
  "summary": {
    "batteryCount": 5,
    "transformerCount": 3,
    "totalCostUsd": 340000,
    "netEnergyMwh": 10.5,
    "landWidthFt": 100,
    "landDepthFt": 20,
    "landAreaSqFt": 2000,
    "energyDensityMwhPerSqFt": 0.00525
  },
  "layout": {
    "blocks": [
      { "deviceName": "MegapackXL", "x": 0, "y": 0, "w": 40, "h": 10 }
    ],
    "widthFt": 100, "depthFt": 20, "areaSqFt": 2000
  }
}
```

### `POST /api/sessions` and `GET /api/sessions/{code}`

```bash
# Save, returns a share code
curl -s localhost:8000/api/sessions \
  -H 'Content-Type: application/json' \
  -d '{"quantities":{"MegapackXL":2}}'
# {"code":"7KQ2M9"}

# Resume by code
curl -s localhost:8000/api/sessions/7KQ2M9
# {"code":"7KQ2M9","quantities":{"MegapackXL":2}}
```

### Validation

Input is validated and capped server-side in `httpapi.validateQuantities`:

- Quantities must be in `0 ≤ qty ≤ 1000` per device. Negative or over-cap values return
  `400 Bad Request`.
- A transformer entry in the request is rejected, since transformers are auto-derived.
- Unknown or non-battery device names are ignored.
- Errors come back as `{ "error": "...message..." }` with the matching status code. The
  typed client in `web/src/api.ts` surfaces that message to the user as-is.

---

## Persistence and share codes

Save and resume have to survive a browser cache clear, so configurations live on the
server. The `Store` interface (`internal/store/store.go`) is small on purpose:

```go
type Store interface {
    Save(ctx, quantities) (code string, err error)
    Load(ctx, code) (Session, error)   // ErrNotFound if missing
    Close() error
}
```

The default implementation is SQLite through `modernc.org/sqlite`, a pure-Go driver.
That lets the binary build with `CGO_ENABLED=0` and run on a distroless image with no C
toolchain. Sessions are a single table keyed by share code; quantities are stored as
JSON and `created_at` as a Unix timestamp, which sidesteps driver-specific time
parsing.

A share code is 6 characters drawn from a 32-symbol alphabet using `crypto/rand`, with
ambiguous characters like `0/O/1/I` removed. That gives 32⁶, roughly 1.07 billion
codes, and `Save` retries on the rare collision. Saving updates the browser URL to
`/?s=CODE`; opening that link reloads the configuration from the server. That is what
makes the link shareable and lets it survive a cache clear.

---

## Frontend

`web/` is a React 19 app written in TypeScript and SCSS, built with Vite 8. It carries
no business logic of its own: `api.ts` mirrors the backend's JSON types, and the
components render whatever the engine returns.

- `Configurator`: one row per battery (name, size, quantity input, live energy).
- `Summary`: the headline figures (cost, land size, net energy), with energy density as
  a secondary stat.
- `SiteLayout`: a to-scale SVG of the packed site using the `{x, y, w, h}` blocks from
  the layout response, drawn with original SVG device icons.
- `SessionBar`: save the current config (which returns a share code and URL) and resume
  a saved one.

State, debounced recalculation, and URL-based save/resume all live in `App.tsx`. The
look is a dark canvas with one restrained accent (Tesla red) and large, legible
numbers.

---

## Configuration

| Env var | Default | Meaning |
|---------|---------|---------|
| `POWERBLOCK_ADDR` | `:8000` | Listen address. |
| `POWERBLOCK_DB` | `powerblock.db` (`/data/powerblock.db` in Docker) | SQLite file path. |

The server sets a `ReadHeaderTimeout`, listens in a goroutine, and shuts down
gracefully on `SIGINT` with a 5-second drain (see `cmd/server/main.go`).

---

## Testing

The backend logic is covered by unit tests: catalog, engine (including the worked
example and the transformer ratio), layout edge cases, the SQLite store, and the HTTP
handlers.

```bash
make test       # backend (go test ./...) + frontend (Vitest)
go test ./...    # backend only
```

---

## Deployment

The `Dockerfile` is a three-stage build:

1. `web` (`node:22-slim`): `npm ci` and `npm run build` produce the SPA.
2. `build` (`golang:1.26`): copies the built `dist/` in, then runs
   `CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"` for a small static binary.
3. `runtime` (`gcr.io/distroless/static-debian12`): just the binary, listening on
   `:8000`, with `/data` as a volume for the database.

```bash
docker compose up        # build + run; sessions persist in the powerblock-data volume
```

The result is a single static binary with no dynamic dependencies, so it runs on
essentially any container host (Fly.io, Render, Cloud Run, a plain VM). Mount a
persistent volume at `/data` so saved sessions survive restarts.

### Live deployment (Fly.io)

The live demo runs on Fly.io, configured by [`fly.toml`](fly.toml):

- Fly builds the same `Dockerfile` and runs the binary on `:8000` behind HTTPS.
- A 1 GB persistent volume (`powerblock_data`) is mounted at `/data`, so the SQLite
  database, and every saved or shared configuration in it, survives restarts and
  redeploys.
- The machine scales to zero when idle and cold-starts on the next request. The ~5 MB Go
  binary boots in milliseconds, which keeps the running cost down to pennies.

Redeploy after changes with:

```bash
flyctl deploy        # rebuilds the image and rolls out a new machine
```

---

## Design decisions and assumptions

- **All logic on the server.** The catalog, pricing, transformer rule, and packing live
  only in Go and are unit-tested. The client never recomputes a number, so it cannot
  drift from the backend.
- **What counts as an "industrial battery."** The brief doesn't define it, so I counted
  all four battery types toward the transformer ratio and excluded transformers from
  their own count.
- **"Energy density."** The brief's example shows energy as a single total, so I made
  total net energy (MWh) the headline figure and kept true energy density (MWh per sq
  ft) as a small secondary stat.
- **Server-side storage instead of `localStorage`,** so a configuration survives a cache
  clear and can be shared by URL.
- **Pure-Go SQLite,** which is what lets the whole thing build and ship with no C
  toolchain and run as one static binary.
- **Inputs are validated and capped** (0 to 1000 per device). Negative quantities and any
  user-supplied transformer entry are rejected at the API boundary.