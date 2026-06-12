

# --- 1. frontend ----------------------------------------------------------
FROM node:22-slim AS web
WORKDIR /src
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci
COPY web/ ./web/

RUN cd web && npm run build

# --- 2. backend -----------------------------------------------------------
FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /src/internal/httpapi/web/dist ./internal/httpapi/web/dist
RUN CGO_ENABLED=0 GOOS=linux  \
    go build -trimpath -ldflags="-s -w" \
    -o /out/powerblock ./cmd/server

# --- 3. runtime -----------------------------------------------------------
FROM gcr.io/distroless/static-debian12 AS runtime
WORKDIR /
COPY --from=build /out/powerblock /powerblock
ENV POWERBLOCK_ADDR=:8000 \
    POWERBLOCK_DB=/data/powerblock.db
EXPOSE 8000

VOLUME ["/data"]
ENTRYPOINT ["/powerblock"]