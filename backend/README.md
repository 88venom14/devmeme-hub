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
  (then `git checkout main` afterwards). Data volumes are untouched by a code rollback,
  so this is safe to do at any time.
- **Database:** auto-migrations are forward-only. `.down.sql` files exist but are not
  run automatically; revert schema changes manually if ever needed.

## Required database tables

Migrations create the required tables automatically:

- `users`, `profiles`, `posts`, `comments`, `stars`, `follows`
- `tags`, `post_tags`, `saved_posts`, `user_activity`
- `chat_conversations`, `chat_messages`
- `games`, `game_tags`, `game_moderation_log`

`profiles(id)` is the public owner identity.
Content tables such as `posts`, `comments`, `stars`, `follows`, `saved_posts`, and
chat tables reference `profiles(id)`. The standalone `users` table stores backend
auth data, and `profiles.id` references `users.id`.

## Mini-games

Authenticated users upload self-contained web games (a `.zip` with a root
`index.html` plus static assets). Uploads enter a moderation queue; only
admin-approved games are publicly playable.

### Storage layout

- Extracted bundles live under `GAMES_DIR` (default `games/`, configurable via the
  `GAMES_DIR` env var; persist it on a volume in production alongside media).
- Each game gets its own directory keyed by its unique slug: `games/<slug>/…`,
  with the entry point at `games/<slug>/index.html`.
- Files are served read-only at `GET /games-static/<slug>/*`. The handler confines
  every request to the game's own directory and sets isolation headers (a strict
  CSP with `connect-src 'none'` and `frame-ancestors` limited to the app origins,
  plus `X-Content-Type-Options: nosniff`).
- Upload limits: archive ≤ 25 MB (`MAX_GAME_UPLOAD_BYTES`), total extracted size
  ≤ 100 MB. Only an allowlist of asset extensions is accepted; zip-slip, absolute
  paths, and symlinks are rejected; a root `index.html` is required.
- When a game is removed (admin takedown) or deleted (by its author), its files are
  deleted from disk so it can no longer be served, even by direct URL. The DB row
  and its moderation log are retained for a takedown (status `removed`).

### Moderation lifecycle

```
upload ─► pending ─► approved   (publicly listed & playable)
                 └─► rejected   (author sees the reason, can edit & resubmit)
approved ─► removed             (admin takedown; files deleted)
rejected/approved ─► pending    (author edits → resubmitted)
```

Every status change is written together with a `game_moderation_log` row in the
same DB transaction, so the audit trail (who, action, reason, when) can never drift
from the game's actual status.

### Granting admin

Admin capability reuses the existing `users.role` column. Promote a user with:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Admin endpoints (`/api/admin/games/*`) are guarded by `requireAdmin`, which
re-checks the role from the DB on every request — UI gating is never trusted, and a
demoted user immediately loses access even with an unexpired token.

### Recommended hardening: separate origin

Games currently run in a sandboxed `<iframe>` **without** `allow-same-origin`,
which already forces each game into a unique opaque origin (no access to the app's
cookies, `localStorage`, or JWT). For defense in depth, serve `/games-static/`
from a **dedicated subdomain** (e.g. `games.example.com`) so a game can never share
an origin with the main app even if a sandbox flag regresses. Point that subdomain
at the same backend (or a CDN in front of `GAMES_DIR`) and set `frame-ancestors`
accordingly. The `GameFrame` React component is the single client-side source of
truth for the sandbox attributes.

### Game routes

- `GET    /api/games` — list approved games (supports `?q=` and `?tag=`).
- `GET    /api/games/{slug}` — approved game metadata (author may fetch their own).
- `POST   /api/games/{slug}/play` — increment play count.
- `POST   /api/games` — multipart upload (`archive`, `title`, `description`, `tags`,
  `thumbnail_url`); creates a `pending` game.
- `GET    /api/me/games` — the caller's own submissions and their statuses.
- `PUT    /api/games/{slug}` — edit metadata / re-upload archive (resets to pending).
- `DELETE /api/games/{slug}` — author removes their own game.
- `GET    /api/admin/games?status=pending` — admin queue with status counts.
- `POST   /api/admin/games/{slug}/approve`
- `POST   /api/admin/games/{slug}/reject` — body `{ "reason": "…" }` (required).
- `POST   /api/admin/games/{slug}/remove` — takedown (optional reason).
- `GET    /api/admin/games/{slug}/moderation-log`
- `GET    /games-static/{slug}/*` — sandboxed static game assets.

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
