# DevMeme Hub

Соцсеть для разработчиков: лента мемов и постов с тегами, звёздами,
комментариями, подписками, сохранёнными постами и ИИ-чатом.

🔗 **Сайт:** https://fluttershy.horsefucker.ru

## Возможности

- Лента, тренды и страницы по тегам
- Создание постов с медиа и Markdown
- Звёзды, комментарии, сохранённые посты
- Подписки и лента подписок
- Профили и настройки пользователя
- ИИ-чат

## Стек

**Frontend** — React 19, TypeScript, Vite, React Router, TanStack Query.
**Backend** — Go REST API на PostgreSQL (собственный сервис, без Supabase),
JWT-авторизация, загрузка медиа.
**Chat** — Cloudflare Worker, проксирующий запросы к OpenRouter (ИИ-собеседник).

## Структура

```
src/          — фронтенд: pages/, components/, hooks/, lib/, styles/
backend/      — Go API: cmd/ (api, migrate, import-backup), internal/
              — миграции в internal/migrations/sql/
chat-worker/  — Cloudflare Worker (ИИ-чат через OpenRouter)
```
