#!/bin/sh
# Apply database migrations, then hand off to the API server as PID 1
# so it receives SIGTERM for graceful shutdown.
set -e

echo "[entrypoint] applying migrations..."
/app/migrate

echo "[entrypoint] starting API on ${HTTP_ADDR:-:8080}..."
exec /app/api
