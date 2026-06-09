# Repository Guidelines

## Project Structure & Module Organization

This repository contains a React/Vite frontend, a Go REST backend, one Cloudflare Worker, and database migrations.

- `src/` is the frontend source: `pages/`, `components/`, `hooks/`, `lib/`, `types/`, and `styles/`.
- `backend/` contains the Go API, with entrypoints in `cmd/` and private packages under `internal/`.
- `backend/internal/migrations/sql/` holds the PostgreSQL schema and migration SQL.
- `chat-worker/` is a Wrangler Worker project (AI chat proxy). `docs/` contains deployment notes.
- `dist/`, root `assets/`, and worker `dist/` folders are generated output; edit source files instead.

## Build, Test, and Development Commands

- `npm run dev` starts the Vite frontend locally.
- `npm run typecheck` runs `tsc --noEmit` for frontend TypeScript validation.
- `npm run build` typechecks, builds the frontend, and prepares GitHub Pages output via `deploy.mjs`.
- `npm run preview` serves the built frontend locally.
- `npm run deploy` runs the deployment script.
- `cd backend && go run ./cmd/migrate` applies backend migrations.
- `cd backend && go run ./cmd/api` starts the API.
- `cd backend && go test ./...` runs backend tests and compile checks.
- `cd chat-worker && npm run dev` or `cd auth-worker && npm run dev` starts a Worker locally with Wrangler.

## Coding Style & Naming Conventions

Use TypeScript for frontend code. Name React components in PascalCase, for example `PostCard.tsx`, and hooks with the `useThing` pattern. Keep shared data shapes in `src/types/` and API access in `src/lib/`. Format Go code with `gofmt`; keep backend packages small and scoped under `backend/internal/`. Use numeric migration names in `backend/internal/migrations/sql/`.

## Testing Guidelines

There is no configured frontend test runner yet, so run `npm run typecheck` and `npm run build` before submitting frontend changes. For backend changes, run `go test ./...` from `backend/`. Add Go tests as `*_test.go` beside the package they cover. If adding frontend tests, use `*.test.ts` or `*.test.tsx` and add an npm script.

## Commit & Pull Request Guidelines

Recent history uses short, descriptive subjects such as `Mobile responsive layout, hamburger menu, chat UX, markdown in replies` and `Deploy 2026-05-05 19:12`. Keep subjects concise and outcome-focused. Pull requests should describe the change, list validation commands, link issues, and include screenshots for visible UI changes.

## Security & Configuration Tips

Copy `.env.example` files instead of committing secrets. For backend work, copy `backend/.env.example` to `backend/.env` and set a production-safe `JWT_SECRET`. Keep Wrangler secrets and database URLs private.
