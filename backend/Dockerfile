# syntax=docker/dockerfile:1

# ---- build stage -------------------------------------------------------------
FROM golang:1.24-alpine AS builder

WORKDIR /src

# Cache module downloads separately from the source for faster rebuilds.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build static binaries (no libc dependency) so they run on a bare alpine image.
# Migrations are embedded via go:embed, so no SQL files need to ship separately.
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags="-s -w" -o /out/api           ./cmd/api && \
    go build -trimpath -ldflags="-s -w" -o /out/migrate       ./cmd/migrate && \
    go build -trimpath -ldflags="-s -w" -o /out/import-backup ./cmd/import-backup

# ---- runtime stage -----------------------------------------------------------
FROM alpine:3.20

# ca-certificates for outbound TLS, wget is used by the compose healthcheck.
RUN apk add --no-cache ca-certificates wget && \
    adduser -D -u 10001 app

WORKDIR /app

COPY --from=builder /out/api           /app/api
COPY --from=builder /out/migrate       /app/migrate
COPY --from=builder /out/import-backup /app/import-backup
COPY docker-entrypoint.sh              /app/docker-entrypoint.sh

# Media uploads live here and are mounted as a volume in production.
RUN mkdir -p /app/media && \
    chown -R app:app /app && \
    chmod +x /app/docker-entrypoint.sh

USER app

ENV HTTP_ADDR=:8080 \
    MEDIA_DIR=/app/media

EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
