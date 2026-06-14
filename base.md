# devmeme-hub Project Base

Last updated: 2026-06-09.

This file is a handoff document for future AI/code sessions. It describes the current state, important decisions, local setup, deployment assumptions, and known caveats.

## Project Overview

`devmeme-hub` is a developer-oriented social platform built on a self-hosted Go + PostgreSQL backend with a React/Vite frontend.

Current direction:

- Frontend: React + Vite SPA.
- Backend: Go REST API.
- Database: PostgreSQL, self-contained, no external BaaS runtime dependency.
- Production frontend target: GitHub Pages at `https://fluttershy.horsefucker.ru`.
- Production backend target: separate VPS, recommended API origin `https://api.fluttershy.horsefucker.ru`.

## Repository Layout

Important paths:

- `src/` - React frontend.
- `src/lib/api.ts` - frontend API client for the Go backend.
- `src/components/ui/VideoPlayer.tsx` - custom video player with unsupported-codec fallback.
- `backend/` - Go backend module.
- `backend/internal/httpapi/` - REST handlers and router.
- `backend/internal/migrations/sql/` - PostgreSQL migrations.
- `backend/cmd/api` - backend server entrypoint.
- `backend/cmd/migrate` - migration runner.
- `backend/cmd/import-backup` - imports JSONL backup data into local PostgreSQL.
- `backups/devmeme_backup_jsonl/` - local JSONL data export. Ignored by Git.
- `chat-worker/` - Cloudflare Worker that proxies AI chat replies via OpenRouter.
- `.github/workflows/deploy.yml` - GitHub Pages deployment workflow.
- `deploy.mjs` - existing deploy helper. It also supports `--prepare-pages`.
- `docs/deploy-frontend-github-pages.md` - frontend deployment notes.

## Current Frontend State

Stack:

- React `19.2.3`
- Vite `7.2.4`
- React Router `7.14.2`
- TanStack Query `5.100.5`
- TypeScript

API flow:

- `src/lib/api.ts` uses `VITE_API_URL`.
- Local fallback is `http://localhost:8080`.
- Production default in GitHub Actions is `https://api.fluttershy.horsefucker.ru`.
- JWT is stored in `localStorage` under `devmeme_token`.
- Session shape is defined as `AppSession` in `src/lib/api.ts`.
- `SessionContext` holds `AppSession | null`.

Important frontend behavior:

- Email/password login and registration go through the Go backend.
- OAuth buttons are intentionally not wired to the Go backend yet. They show a local-mode message.
- New media uploads call `POST /api/media` on the Go backend.
- Chat messages are stored through the Go backend, but AI replies still call `VITE_CHAT_WORKER_URL` via `src/lib/chat.ts` if configured.

Frontend commands:

```powershell
npm run dev -- --host 127.0.0.1
npm run typecheck
npm run build
```

`npm run build` runs:

```text
tsc --noEmit && vite build && node deploy.mjs --prepare-pages
```

The `--prepare-pages` mode writes:

- `dist/CNAME`
- `dist/404.html`

This is required for GitHub Pages custom domain and React Router fallback.

## Current Backend State

Stack:

- Go module: `devmeme-hub/backend`
- Go `1.24+`
- Router: `chi`
- PostgreSQL driver: `pgx`
- Auth: HMAC JWT (with issuer/audience) + bcrypt password hashes
- Runtime is pure PostgreSQL.

Backend local env example: `backend/.env.example`.

Local backend command:

```powershell
cd C:\project\devmeme-hub\backend
go run .\cmd\api
```

Backend test command:

```powershell
cd C:\project\devmeme-hub\backend
go test ./...
```

Main routes are registered in `backend/internal/httpapi/server.go`.

Public routes:

- `GET /healthz`
- `GET /api/posts`
- `GET /api/posts/{postID}`
- `GET /api/posts/{postID}/comments`
- `GET /api/profiles/{profileID}`
- `GET /api/profiles/username/{username}`
- `GET /api/profiles/{profileID}/posts`
- `GET /api/profiles/{profileID}/stats`
- `GET /api/search`
- `GET /api/tags/top`
- `GET /api/tags/{name}/posts`
- `GET /api/trending/posts`
- `POST /api/auth/register`
- `POST /api/auth/login`

Authenticated routes require:

```http
Authorization: Bearer <token>
```

Authenticated routes:

- `GET /api/auth/me`
- `GET /api/profiles/me`
- `PATCH /api/profiles/me`
- `POST /api/posts`
- `DELETE /api/posts/{postID}`
- `GET /api/posts/{postID}/interactions`
- `POST /api/posts/{postID}/star`
- `DELETE /api/posts/{postID}/star`
- `POST /api/posts/{postID}/save`
- `DELETE /api/posts/{postID}/save`
- `GET /api/saved-posts`
- `GET /api/following/posts`
- `POST /api/comments`
- `DELETE /api/comments/{commentID}`
- `POST /api/media`
- `POST /api/profiles/{profileID}/follow`
- `DELETE /api/profiles/{profileID}/follow`
- `GET /api/profiles/{profileID}/follow-status`
- `GET /api/chat/conversations`
- `POST /api/chat/conversations`
- `DELETE /api/chat/conversations/{conversationID}`
- `GET /api/chat/conversations/{conversationID}/messages`
- `POST /api/chat/conversations/{conversationID}/messages`

## Database State

Local PostgreSQL:

- Database: `devmeme_hub`
- User: `devmeme`
- Local backend URL (docker-compose default):

```text
postgres://devmeme:devmeme@localhost:5432/devmeme_hub?sslmode=disable
```

Schema decisions:

- `users` is the standalone backend auth table.
- `profiles.id` references `users.id`.
- Public ownership tables reference `profiles(id)`.
- `posts`, `comments`, `stars`, `follows`, `saved_posts`, and `chat_*` reference `profiles(id)`.
- bcrypt password hashes are stored in `users.password_hash`.

### Seeding from a JSONL backup

`backend/cmd/import-backup` truncates the public tables and loads a local JSONL
export. The default backup directory is `backups/devmeme_backup_jsonl/`
(override with `BACKUP_DIR`). Backup files are Git-ignored and should stay local.

## Deployment

### Frontend: GitHub Pages

Production frontend domain:

```text
https://fluttershy.horsefucker.ru
```

GitHub Actions workflow:

```text
.github/workflows/deploy.yml
```

Workflow behavior:

- Trigger: push to `main` or manual `workflow_dispatch`.
- Uses Node `22`.
- Runs `npm ci`.
- Builds with:

```text
VITE_API_URL=${{ vars.VITE_API_URL || 'https://api.fluttershy.horsefucker.ru' }}
VITE_CHAT_WORKER_URL=${{ vars.VITE_CHAT_WORKER_URL || '' }}
npm run build
```

- Uploads `dist/` with `actions/upload-pages-artifact`.
- Deploys with `actions/deploy-pages`.

Recommended GitHub Actions variable:

```text
VITE_API_URL=https://api.fluttershy.horsefucker.ru
```

Do not deploy production from local commands unless explicitly requested.

### Backend: VPS

The backend will be deployed separately to the user's VPS.

Recommended public backend URL:

```text
https://api.fluttershy.horsefucker.ru
```

Production backend must use HTTPS. If the frontend is HTTPS and backend is HTTP, browsers will block requests as mixed content.

Required production backend env caveats:

- Use a strong, unique `JWT_SECRET` of at least 32 characters (known placeholder values are rejected at startup).
- Set `DATABASE_URL` to the VPS PostgreSQL URL.
- Set `ALLOWED_ORIGINS=https://fluttershy.horsefucker.ru`.
- Set `MEDIA_DIR` to a persistent directory.
- Put the backend behind a reverse proxy (Nginx/Caddy) with TLS.

## Git Ignore / Commit Hygiene

Root `.gitignore` currently ignores:

- `node_modules/` and nested `*/node_modules/`
- backend build/runtime output (`backend/bin/`, `backend/media/`, `backend/.gocache/`, backend logs)
- `backups/`
- `*.dump`, `*.backup`, `*.jsonl`
- `*.log`, `vite*.log`
- `.env`, `.env.*`, except examples
- common cache/editor/OS files

`backend/.gitignore` additionally ignores backend-local `.env`, binaries, uploads, logs, profiles, and export artifacts.

Important nuance:

- `dist/` is required for the current GitHub Pages deployment model.
- Do not remove `dist/` from Git unless the user explicitly changes deployment strategy.
- If touching `.gitignore`, do not blindly ignore `dist/` or root `assets/` without confirming the active deployment model.

## Known Issues and Caveats

### Chromium Video Playback

Some imported videos play in Firefox but not Chromium. Chromium DevTools may show:

```text
NotSupportedError: The element has no supported sources.
```

This usually means the Chromium build lacks support for the video's codec/container, not that React is broken. It is common with Chromium builds without proprietary codecs and videos such as:

- `.mp4` with H.264/AAC
- `.mov` / QuickTime

`src/components/ui/VideoPlayer.tsx` was updated to:

- catch `video.play()` promise errors;
- handle `onError`;
- provide a fallback message;
- provide a direct link to open the video.

Full production fix should be server-side media normalization:

- accept uploads;
- transcode to WebM VP9/Opus or browser-compatible MP4 H.264/AAC;
- ideally use `faststart` for MP4.

### Media Storage

New uploads currently go to the Go backend via `POST /api/media`, saved under `backend/media` locally.

For VPS production:

- `MEDIA_DIR` must be persistent.
- Reverse proxy must serve `/media/...` or forward to the Go backend.

### Chat AI

Chat conversations/messages are stored in PostgreSQL through the Go backend.

The AI assistant reply still calls `VITE_CHAT_WORKER_URL` from frontend code in `src/lib/chat.ts`. If unset, AI reply will fail. This is separate from DB chat storage. The `chat-worker/` Worker restricts requests by `Origin` and proxies OpenRouter under a server-held key.

### OAuth

OAuth is not wired to the Go backend yet.

Email/password auth works through the Go backend. OAuth buttons intentionally show a backend-not-connected message. The `auth_identities` table exists for a future Go-native OAuth implementation.

## Local Run Checklist

Start PostgreSQL (docker-compose):

```powershell
cd C:\project\devmeme-hub\backend
docker compose up -d
```

Start backend:

```powershell
cd C:\project\devmeme-hub\backend
go run .\cmd\api
```

Start frontend:

```powershell
cd C:\project\devmeme-hub
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173
```

Quick API checks:

```powershell
Invoke-RestMethod http://localhost:8080/healthz
Invoke-RestMethod http://localhost:8080/api/posts
```

If using `127.0.0.1:5173`, backend CORS must include:

```text
http://127.0.0.1:5173
```

## Verification Commands

Frontend:

```powershell
npm run typecheck
npm run build
```

Backend:

```powershell
cd backend
go test ./...
```

## Things Not To Do Without Explicit User Approval

- Do not deploy to production.
- Do not run `git reset --hard`.
- Do not remove `dist/` from Git unless deployment strategy is clarified.
- Do not commit `.env`, database passwords, backups, dumps, logs, or media uploads.
