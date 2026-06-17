#!/usr/bin/env bash
# Deploy the DevMeme backend + DB stack from this git checkout.
#
# Usage on the server:
#   cd /opt/devmeme-hub && ./backend/deploy.sh
#
# What it does: pulls latest code, then rebuilds and restarts the three
# containers (Caddy -> Go backend -> Postgres). DB migrations run automatically
# on backend startup (docker-entrypoint.sh), so new SQL migrations in
# backend/internal/migrations/sql/ are applied as part of the rebuild.
set -euo pipefail

# Repo root = parent of the dir holding this script (…/backend).
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "[deploy] git pull (ff-only)…"
git pull --ff-only

cd "$REPO_DIR/backend"

if [ ! -f .env.production ]; then
  echo "[deploy] ERROR: backend/.env.production is missing. Restore it before deploying." >&2
  exit 1
fi

# IMPORTANT: pin the compose project name to 'devmeme'. The persistent named
# volumes are devmeme_devmeme_postgres_data / _media_data / _caddy_data /
# _caddy_config. Compose derives the project name from the directory by default;
# pinning it here keeps the EXISTING data volumes attached no matter which
# directory we deploy from. Changing this would create fresh, EMPTY volumes and
# the database + uploaded media would appear lost.
export COMPOSE_PROJECT_NAME=devmeme

echo "[deploy] building & starting stack (project=$COMPOSE_PROJECT_NAME)…"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo "[deploy] current state:"
docker compose -f docker-compose.prod.yml ps
echo "[deploy] done."
