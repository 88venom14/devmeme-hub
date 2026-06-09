# devmeme-hub Project Base

Last updated: 2026-05-29.

This file is a handoff document for future AI/code sessions. It describes the current state, important decisions, local setup, deployment assumptions, and known caveats.

## Project Overview

`devmeme-hub` is a developer-oriented social platform. The app was originally built around Supabase tables/Auth/Storage and is being migrated to a self-hosted Go + PostgreSQL backend.

Current direction:

- Frontend: React + Vite SPA.
- Backend: Go REST API.
- Database: PostgreSQL, self-contained, no Supabase runtime dependency.
- Production frontend target: GitHub Pages at `https://fluttershy.horsefucker.ru`.
- Production backend target: separate VPS, recommended API origin `https://api.fluttershy.horsefucker.ru`.
- Supabase is only legacy/source-of-data now. Do not reintroduce Supabase client code unless explicitly requested.

## Repository Layout

Important paths:

- `src/` - React frontend.
- `src/lib/api.ts` - frontend API client for the Go backend. This replaced direct Supabase usage.
- `src/components/ui/VideoPlayer.tsx` - custom video player with unsupported-codec fallback.
- `backend/` - Go backend module.
- `backend/internal/httpapi/` - REST handlers and router.
- `backend/internal/migrations/sql/` - PostgreSQL migrations.
- `backend/cmd/api` - backend server entrypoint.
- `backend/cmd/migrate` - migration runner.
- `backend/cmd/import-backup` - imports JSONL backup data into local PostgreSQL.
- `backend/cmd/export-supabase` - legacy exporter from Supabase to JSONL.
- `backups/devmeme_supabase_jsonl/` - local JSONL export from Supabase. Ignored by Git.
- `.github/workflows/deploy.yml` - GitHub Pages deployment workflow.
- `deploy.mjs` - existing deploy helper. It now also supports `--prepare-pages`.
- `docs/deploy-frontend-github-pages.md` - frontend deployment notes.

## Current Frontend State

Stack:

- React `19.2.3`
- Vite `7.2.4`
- React Router `7.14.2`
- TanStack Query `5.100.5`
- TypeScript

Frontend no longer imports `@supabase/supabase-js`; `src/lib/supabase.ts` was deleted.

API flow:

- `src/lib/api.ts` uses `VITE_API_URL`.
- Local fallback is `http://localhost:8080`.
- Production default in GitHub Actions is `https://api.fluttershy.horsefucker.ru`.
- JWT is stored in `localStorage` under `devmeme_token`.
- Session shape is defined as `AppSession` in `src/lib/api.ts`.
- `SessionContext` now holds `AppSession | null`, not Supabase `Session`.

Important frontend behavior:

- Email/password login and registration go through Go backend.
- OAuth buttons are intentionally not wired to local Go backend yet. They show a local-mode message.
- New media uploads call `POST /api/media` on the Go backend.
- Old imported media URLs may still point to Supabase Storage or the old Worker proxy.
- Chat messages are stored through Go backend, but AI replies still call `VITE_CHAT_WORKER_URL` via `src/lib/chat.ts` if configured.

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
- Go `1.24`
- Router: `chi`
- PostgreSQL driver: `pgx`
- Auth: HMAC JWT + bcrypt password hashes
- Runtime is pure PostgreSQL, not Supabase.

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

Legacy Supabase project:

- Project name: `devmeme`
- Project ref/id: `noozgghctswdfnicmcnd`

Supabase was used as the source of truth for backup/export. The current backend should not depend on Supabase.

Local PostgreSQL:

- Data dir: `C:\tmp\devmeme_pgdata`
- Port: `55432`
- User: `devmeme`
- Database: `devmeme_hub`
- Local backend URL:

```text
postgres://devmeme@localhost:55432/devmeme_hub?sslmode=disable
```

Start local PostgreSQL if needed:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D C:\tmp\devmeme_pgdata -l C:\tmp\devmeme_pglog.txt -o '-p 55432' start
```

Imported local counts after migration/import:

- `users`: 15
- `profiles`: 15
- `posts`: 24
- `comments`: 25
- `stars`: 30
- `follows`: 7
- `tags`: 20
- `post_tags`: 25
- `saved_posts`: 11
- `chat_conversations`: 12
- `chat_messages`: 66
- `user_activity`: 0 in backup

Schema decisions:

- `users` is now standalone backend auth.
- `profiles.id` references `users.id`.
- Public ownership tables still reference `profiles(id)` to preserve legacy Supabase behavior.
- `posts`, `comments`, `stars`, `follows`, `saved_posts`, and `chat_*` reference `profiles(id)`.
- Supabase `auth.users.encrypted_password` was imported into `users.password_hash`. Existing Supabase bcrypt hashes are compatible with Go bcrypt login.
- Legacy constraints were relaxed because old data includes Cyrillic usernames and large content.

## Supabase Backup Details

Local JSONL backup directory:

```text
C:\project\devmeme-hub\backups\devmeme_supabase_jsonl
```

Backup files are ignored by Git and should stay local.

`pg_dump` through Supabase pooler was unreliable. JSONL export was used instead.

Important: the user shared a Supabase database password in a previous session. Do not repeat it, do not commit it, and do not put it in docs.

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

Backend will be deployed separately to the user's VPS.

Recommended public backend URL:

```text
https://api.fluttershy.horsefucker.ru
```

Production backend must use HTTPS. If the frontend is HTTPS and backend is HTTP, browsers will block requests as mixed content.

Required production backend env caveats:

- Use a strong `JWT_SECRET` with at least 32 characters.
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

- The user says `dist/` is required for their GitHub Pages deployment model.
- Do not remove `dist/` from Git unless the user explicitly changes deployment strategy.
- A previous attempt to run `git rm --cached -- dist assets` failed with `index.lock permission denied`; no files were removed from Git.
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
- Reverse proxy must serve `/media/...` or forward to Go backend.
- Existing imported media URLs may still point at Supabase Storage or old worker URLs.

### Chat AI

Chat conversations/messages are stored in PostgreSQL through the Go backend.

The AI assistant reply still calls `VITE_CHAT_WORKER_URL` from frontend code in `src/lib/chat.ts`. If unset, AI reply will fail. This is separate from DB chat storage.

### OAuth

OAuth is not wired to the Go backend yet.

Email/password auth works through the Go backend. OAuth buttons intentionally show a local/backend-not-connected message.

## Local Run Checklist

Start PostgreSQL:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D C:\tmp\devmeme_pgdata -l C:\tmp\devmeme_pglog.txt -o '-p 55432' start
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

Last known verification status in this session:

- `npm run typecheck` passed.
- `npm run build` passed after moving Pages preparation into `deploy.mjs --prepare-pages`.
- `go test ./...` passed.

## Things Not To Do Without Explicit User Approval

- Do not deploy to production.
- Do not run `git reset --hard`.
- Do not remove `dist/` from Git unless deployment strategy is clarified.
- Do not commit `.env`, database passwords, backups, dumps, logs, or media uploads.
- Do not re-add Supabase runtime dependencies to frontend unless the user explicitly asks.
- Do not print or document the previously shared Supabase password.
