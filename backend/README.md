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

## Deploy to a server (2 containers)

Production runs two containers defined in `docker-compose.prod.yml`:

- `postgres` — PostgreSQL 16, data persisted in the `devmeme_postgres_data` volume.
- `backend` — the Go API; on startup it applies migrations, then serves on `:8080`.
  Uploaded media persists in the `devmeme_media_data` volume.

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
- Migrations run automatically on every `backend` start (idempotent).
- To update after a code change: `docker compose -f docker-compose.prod.yml up -d --build backend`.

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
