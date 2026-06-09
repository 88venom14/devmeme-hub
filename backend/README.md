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
