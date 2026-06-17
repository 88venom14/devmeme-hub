# devmeme-hub Go backend

Self-contained REST API backend backed by PostgreSQL.

## Run

```powershell
cd backend
copy .env.example .env
docker compose up -d
# edit JWT_SECRET in .env before production use
go run ./cmd/migrate
go run ./cmd/api
```

Health check:

```powershell
Invoke-RestMethod http://localhost:8080/healthz
```

## Deploy to a server (3 containers)

Production runs three containers defined in `docker-compose.prod.yml`:

- `caddy` — TLS termination + reverse proxy (ports 80/443, automatic Let's Encrypt).
- `backend` — the Go API; on startup it applies migrations, then serves on `:8080`.
  Uploaded media persists in the `devmeme_media_data` volume.
- `postgres` — PostgreSQL 16, data persisted in the `devmeme_postgres_data` volume.

On the server (Docker + Compose required):

```bash
cd backend
cp .env.production.example .env.production
# Edit .env.production: set POSTGRES_PASSWORD, JWT_SECRET (>=32 chars), ALLOWED_ORIGINS
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Check status and logs:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
curl http://localhost:8080/healthz
```

Notes:

- Postgres is not exposed to the host by default; only the backend reaches it over
  the internal compose network. Put a reverse proxy (nginx/Caddy) with TLS in front
  of the backend for public traffic.
- Migrations run automatically on every `backend` start (idempotent), so new SQL
  files in `internal/migrations/sql/` are applied on the next deploy.

## Updating production via git pull

Production is a git checkout at `/opt/devmeme-hub`. To ship backend or DB changes:

```bash
cd /opt/devmeme-hub
./backend/deploy.sh          # git pull --ff-only + rebuild + restart
```

`deploy.sh` pins `COMPOSE_PROJECT_NAME=devmeme` so the existing data volumes
(`devmeme_devmeme_postgres_data`, `devmeme_devmeme_media_data`, …) stay attached.
**Never deploy without that pin** — a different project name creates fresh, empty
volumes and the database + media appear lost.

## Rollback

- **Code:** `cd /opt/devmeme-hub && git checkout <previous-commit> && ./backend/deploy.sh`
  (then `git checkout main` afterwards). Data volumes are untouched by a code rollback.
- **Emergency fallback:** the previous file-copy deploy is preserved at `/opt/devmeme`:
  `cd /opt/devmeme && COMPOSE_PROJECT_NAME=devmeme docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
- **Database:** auto-migrations are forward-only. `.down.sql` files exist but are not
  run automatically; revert schema changes manually if ever needed.

## Required database tables

Migrations create the required tables automatically:

- `users`, `profiles`, `posts`, `comments`, `stars`, `follows`
- `tags`, `post_tags`, `saved_posts`, `user_activity`
- `chat_conversations`, `chat_messages`

`profiles(id)` is the public owner identity.
Content tables such as `posts`, `comments`, `stars`, `follows`, `saved_posts`, and
chat tables reference `profiles(id)`. The standalone `users` table stores backend
auth data, and `profiles.id` references `users.id`.

## Main routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/{postID}`
- `GET /api/posts/{postID}/comments`
- `POST /api/comments`
- `POST /api/posts/{postID}/star`
- `POST /api/posts/{postID}/save`
- `GET /api/profiles/{profileID}`
- `PATCH /api/profiles/me`
- `GET /api/tags/top`
- `GET /api/trending/posts`
- `GET /api/chat/conversations`

Authenticated routes require:

```http
Authorization: Bearer <token>
```
