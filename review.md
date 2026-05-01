# Code Review — devMeme Hub

> Дата: 2026-05-01 | Ветка: gh-pages | Стек: React 19, TypeScript, Vite, Supabase, TanStack Query

---

## Оглавление

1. [Структура проекта](#1-структура-проекта)
2. [Компоненты и страницы](#2-компоненты-и-страницы)
3. [Мёртвый код и неиспользуемые файлы](#3-мёртвый-код-и-неиспользуемые-файлы)
4. [Дублирование кода](#4-дублирование-кода)
5. [Проблемы типизации](#5-проблемы-типизации)
6. [Производительность](#6-производительность)
7. [Архитектура](#7-архитектура)
8. [Безопасность](#8-безопасность)
9. [Утечки памяти](#9-утечки-памяти)
10. [Итоговая таблица](#10-итоговая-таблица)
11. [Приоритет исправлений](#11-приоритет-исправлений)

---

## 1. Структура проекта

```
src/
├── pages/           # 11 страниц
├── components/
│   ├── layout/      # AppShell, SearchBar
│   ├── feed/        # PostCard, PostComposer
│   ├── icons.tsx    # SVG иконки (частично неиспользуемые)
│   └── MarkdownContent.tsx
├── lib/             # supabase, storage, tags, validation
├── hooks/           # useSession, useInvalidatePosts, useTopTags
├── context/         # SessionContext
├── utils/           # cn()
└── styles/          # CSS
```

**Оценка структуры:** В целом разумная, но `components/` не разделён по доменам — feed-компоненты вперемешку с layout и утилитами.

---

## 2. Компоненты и страницы

| Файл | Строк | Описание |
|------|-------|----------|
| `pages/FeedPage.tsx` | ~222 | Главная лента с сортировкой hot/new/top |
| `pages/CreatePostPage.tsx` | ~530 | Редактор поста + live preview |
| `pages/PostDetailPage.tsx` | ~430 | Просмотр поста + threaded комментарии |
| `pages/ProfilePage.tsx` | ~350 | Профиль пользователя с баннером |
| `pages/SettingsPage.tsx` | ~450 | Редактирование профиля |
| `pages/SavedPostsPage.tsx` | ~80 | Сохранённые посты |
| `pages/FollowingPage.tsx` | ~80 | Лента подписок |
| `pages/TagPage.tsx` | ~80 | Посты по тегу |
| `pages/TrendingPage.tsx` | ~60 | Топ за 7 дней |
| `pages/LoginPage.tsx` | ~200 | OAuth + email auth |
| `pages/AuthCallback.tsx` | ~40 | OAuth redirect handler |
| `components/layout/AppShell.tsx` | ~285 | Главный layout + сайдбар |
| `components/feed/PostCard.tsx` | ~490 | Карточка поста |
| `components/MarkdownContent.tsx` | ~130 | Markdown рендерер |
| `components/layout/SearchBar.tsx` | ~180 | Поиск с автозаполнением |

---

## 3. Мёртвый код и неиспользуемые файлы

### 3.1 `src/components/icons.tsx` — почти весь файл не используется

Файл экспортирует иконки, но PostCard определяет все свои иконки inline (строки 19–44 PostCard.tsx). Импортов `icons.tsx` в проекте практически нет.

**Неиспользуемые экспорты:**
- `HomeIcon`
- `NewPostIcon`
- `ProfileIcon`
- `SettingsIcon`
- `SubscriptionsIcon`
- И возможно все остальные (PostCard не импортирует из icons.tsx)

**Действие:** Удалить `icons.tsx` или заменить inline SVG в PostCard на импорты из него.

---

### 3.2 `src/utils/cn.ts` — минимальное использование

Утилита для объединения классов (аналог `clsx`), но весь проект использует inline `style={{}}`. Практически нигде не вызывается.

**Действие:** Удалить если нет планов на className-based стили.

---

### 3.3 `src/components/feed/PostComposer.tsx`

Судя по структуре — существует отдельный `PostComposer`, но в `FeedPage` реализован inline `ComposerWidget`. Один из них лишний.

**Действие:** Проверить, импортируется ли PostComposer где-либо. Если нет — удалить.

---

## 4. Дублирование кода

### 4.1 Avatar — повторяется 6+ раз

Один и тот же паттерн во всех компонентах:

```tsx
// AppShell.tsx, PostCard.tsx, PostDetailPage.tsx,
// CreatePostPage.tsx, SettingsPage.tsx, FeedPage.tsx
{avatarUrl ? (
  <img src={avatarUrl} style={{ width: N, height: N, borderRadius: '50%', objectFit: 'cover' }} />
) : (
  <div style={{ width: N, height: N, borderRadius: '50%', background: 'var(--accent)', ... }}>
    {initial}
  </div>
)}
```

**Решение:** Создать `src/components/Avatar.tsx`:
```tsx
const Avatar = ({ url, name, size = 36 }: { url?: string | null; name?: string | null; size?: number }) => { ... }
```

---

### 4.2 Профиль текущего пользователя запрашивается 4 раза с разными ключами

| Файл | queryKey |
|------|----------|
| `AppShell.tsx:45` | `['my-profile-mini', session?.user.id]` |
| `FeedPage.tsx:153` | `['profile', session?.user.id]` |
| `CreatePostPage.tsx:197` | `['profile', session?.user.id]` |
| `PostDetailPage.tsx` | `['profile', session?.user.id]` |

TanStack Query кэширует по ключу — несовпадение ключей (`my-profile-mini` vs `profile`) приводит к двойным сетевым запросам.

**Решение:** Создать `useMyProfile()` хук с единым `queryKey: ['profile', userId]`.

---

### 4.3 Инлайновые стили кнопок дублируются

Кнопки «Отмена» и «Опубликовать/Сохранить» полностью идентичны по стилям в:
- `CreatePostPage.tsx` (форма + preview-режим)
- `SettingsPage.tsx`

**Решение:** Вынести `<PrimaryButton>` и `<SecondaryButton>` в `src/components/ui/`.

---

### 4.4 Loading-состояния

Везде одинаковый паттерн текстового лоадера:
```tsx
<div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
  загрузка…
</div>
```

Встречается в: FeedPage, PostDetailPage, ProfilePage, TagPage, TrendingPage, SavedPostsPage, FollowingPage.

**Решение:** Компонент `<LoadingSpinner />` или хотя бы константа стиля.

---

## 5. Проблемы типизации

### 5.1 `as unknown as PostWithMeta` — во всех страницах

```ts
// FeedPage.tsx:147, ProfilePage.tsx:61, FollowingPage.tsx:31,
// PostDetailPage.tsx:118, TrendingPage.tsx:17, SavedPostsPage.tsx
return data as unknown as PostWithMeta[];
```

Это двойное приведение скрывает несовместимость между типами Supabase и самодельным `PostWithMeta`. Если структура БД изменится — TypeScript не предупредит.

**Причина:** `POST_SELECT` — это строка с джойнами, Supabase inferring возвращает сложный тип. Нужно использовать `Database['public']['Tables']['posts']['Row']` или генерацию типов через `supabase gen types`.

---

### 5.2 `as any` в MarkdownContent

```ts
// MarkdownContent.tsx:14
[[rehypeHighlight as any, { detect: true, ignoreMissing: true }]];
```

**Решение:** Правильный тип из `@types/rehype-highlight` или обновить до версии с нативными типами.

---

### 5.3 Non-null assertion `!` в 10+ местах

```ts
session!.user.id   // AppShell, CreatePostPage, SettingsPage, ...
id!                // PostDetailPage
```

Каждое `!` — потенциальный runtime crash если значение окажется null. Большинство защищены через `enabled: !!session`, но это неочевидно.

---

### 5.4 Отсутствие типа для `profile.github_repo_json`

```ts
// supabase.ts
export type GithubRepoData = { ... } | null;
```

Тип определён, но `github_repo_json` в базе — `jsonb`, который Supabase возвращает как `Json`. Приведение молча проглатывает ошибки структуры.

---

## 6. Производительность

### 6.1 Scroll listener без throttle — `AppShell.tsx:32-42`

```ts
const onScroll = () => {
  const y = window.scrollY;
  if (y < 80) setNavHidden(false);
  else if (y > lastScrollY.current + 4) setNavHidden(true);
  else if (y < lastScrollY.current - 4) setNavHidden(false);
  lastScrollY.current = y;
};
window.addEventListener('scroll', onScroll, { passive: true });
```

При быстром скролле вызывается 60+ раз в секунду, каждый вызов обновляет `lastScrollY.current`. Флаг `navHidden` меняется реже (порог 4px), но сама функция всё равно тяжёлая при длинном сайдбаре.

**Решение:**
```ts
const rafId = useRef<number>(0);
const onScroll = () => {
  cancelAnimationFrame(rafId.current);
  rafId.current = requestAnimationFrame(() => { /* логика */ });
};
```

---

### 6.2 Нет `staleTime` для постов в FeedPage

```ts
// FeedPage.tsx:139
const { data: posts } = useQuery({
  queryKey: ['posts'],
  queryFn: async () => { ... },
  // staleTime не задан — каждый фокус вкладки делает refetch
});
```

При переходе на другую страницу и возврате — посты перезапрашиваются. При 100+ постах это заметно.

**Решение:** `staleTime: 30_000` — 30 секунд достаточно для ленты.

---

### 6.3 Blob URLs не отзываются — `CreatePostPage.tsx:185-187`

```ts
const imageObjectUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);
const videoObjectUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);
```

При смене файла старый blob URL остаётся в памяти. При размонтировании компонента оба URL утекают.

**Решение:**
```ts
useEffect(() => {
  return () => {
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
  };
}, [imageObjectUrl]);
```

---

### 6.4 Нет lazy loading страниц

```ts
// App.tsx — все страницы импортированы статически
import FeedPage from './pages/FeedPage';
import SettingsPage from './pages/SettingsPage';
// ...
```

Весь код собирается в один bundle (877 kB minified). Пользователь, открывший только ленту, скачивает код SettingsPage, CreatePostPage и т.д.

**Решение:**
```ts
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CreatePostPage = lazy(() => import('./pages/CreatePostPage'));
// Wrap <Suspense fallback={<Loader />}>
```

Ожидаемый выигрыш: -30–40% от начального bundle.

---

### 6.5 Нет виртуализации списков

Все посты и комментарии рендерятся в DOM сразу. При 200+ постах в ленте производительность деградирует.

**Решение:** `@tanstack/react-virtual` или пагинация через `useInfiniteQuery`.

---

## 7. Архитектура

### 7.1 God component — `AppShell.tsx`

285 строк, содержит:
- Главный layout
- Scroll-to-hide логику
- Запрос профиля текущего пользователя
- `UserCard` компонент (inline)
- `BrowseTags` компонент (inline)
- Запрос тегов

**Решение:** Разделить на:
```
components/layout/
├── AppShell.tsx          # только layout + outlet
├── UserCard.tsx          # вынести как отдельный файл
├── BrowseTags.tsx        # вынести как отдельный файл
└── hooks/useScrollHide.ts
```

---

### 7.2 God component — `CreatePostPage.tsx` (530 строк)

Включает форму, валидацию, media upload, preview рендеринг, mutation. Всё в одном файле.

**Решение:**
```
pages/create/
├── CreatePostPage.tsx    # orchestration только
├── PostForm.tsx          # поля формы
├── PostPreview.tsx       # компонент превью (уже частично вынесен)
└── useCreatePost.ts      # useMutation + логика
```

---

### 7.3 Hardcode redirect URL

```ts
// vite.config.ts:38
'import.meta.env.VITE_REDIRECT_URL': JSON.stringify('https://88venom14.github.io/devmeme/auth/callback')
```

URL захардкожен прямо в конфиге сборки. При смене домена нужно менять код.

**Решение:** Перенести в `.env`:
```
VITE_REDIRECT_URL=https://fluttershy.horsefucker.ru/auth/callback
```

---

### 7.4 Отсутствует Error Boundary

Любая JS-ошибка в компоненте (например, `null.username`) падает весь React-дерево и пользователь видит белый экран без объяснения причины.

**Решение:**
```tsx
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div>Что-то пошло не так. <button onClick={() => location.reload()}>Перезагрузить</button></div>;
    return this.props.children;
  }
}
```

---

### 7.5 Нет оптимистичных обновлений для комментариев

В `PostDetailPage.tsx` комментарий добавляется только после ответа сервера. Лайки (PostCard.tsx) используют оптимистичный update — отличный пример, нужно применить то же для комментариев.

---

## 8. Безопасность

### 8.1 XSS через `href` в MarkdownContent — СРЕДНИЙ РИСК

```tsx
// MarkdownContent.tsx:44
a: ({ href, children: c }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {c}
  </a>
),
```

Если пользователь напишет `[кликни](javascript:alert(document.cookie))` — выполнится JS.

**Решение:**
```ts
const safehref = (url = '') => {
  try {
    const parsed = new URL(url, window.location.href);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return url;
  } catch { /* ignore */ }
  return '#';
};
// ...
<a href={safehref(href)} ...>
```

---

### 8.2 CSS injection в `backgroundImage` — НИЗКИЙ РИСК

```tsx
// ProfilePage.tsx, SettingsPage.tsx
backgroundImage: profile.banner_url ? `url(${profile.banner_url})` : undefined,
```

Если `banner_url` содержит `); expression(...)` — в старых браузерах возможен CSS injection.

**Решение:** Пропускать только URL с доверенными хостами (Supabase Storage CDN) или оборачивать в `CSS.escape()`.

---

### 8.3 Токены в URL History — НИЗКИЙ РИСК

```ts
// AuthCallback.tsx:11
const hashParams = new URLSearchParams(window.location.hash.substring(1));
const accessToken = hashParams.get('access_token');
```

Токены из hash попадают в `window.history` и могут быть прочитаны сторонними скриптами через `document.referrer`.

**Хорошо:** PKCE flow уже настроен в `supabase.ts` — после перехода на него этот код можно удалить.

---

### 8.4 Фронтенд проверки без RLS

```tsx
// PostCard.tsx
const isOwner = !!userId && userId === post.user_id;
// ...
{isOwner && <button onClick={handleDelete}>Удалить</button>}
```

Кнопка скрыта на фронтенде, но `supabase.from('posts').delete()` вызывается без server-side проверки владельца. Если в Supabase нет RLS политики `DELETE WHERE user_id = auth.uid()` — любой может удалить чужой пост через консоль браузера.

**Действие:** Убедиться что RLS включён на таблицах `posts`, `comments`, `stars`, `saved_posts`.

---

## 9. Утечки памяти

| Проблема | Файл | Строки |
|----------|------|--------|
| Blob URLs не revoke при смене файла | `CreatePostPage.tsx` | 185–187 |
| Blob URLs не revoke при размонтировании | `CreatePostPage.tsx` | 185–187 |
| Scroll listener не cleanup в edge cases | `AppShell.tsx` | 32–42 |

Scroll listener правильно убирается в cleanup функции useEffect — это хорошо. Blob URL — проблема.

---

## 10. Итоговая таблица

| # | Категория | Критичность | Кол-во мест | Примеры файлов |
|---|-----------|-------------|-------------|----------------|
| 1 | Мёртвый код | Низкая | 3 файла | `icons.tsx`, `cn.ts`, `PostComposer.tsx` |
| 2 | Дублирование Avatar | Средняя | 6 мест | Все страницы |
| 3 | Дублирование profile query | Средняя | 4 места | AppShell, FeedPage, CreatePostPage, PostDetailPage |
| 4 | `as unknown` приведение | Средняя | 6 файлов | Все страницы с постами |
| 5 | `as any` | Низкая | 1 | MarkdownContent |
| 6 | Non-null assertions `!` | Низкая | 10+ | Повсюду |
| 7 | Scroll без throttle | Средняя | 1 | AppShell |
| 8 | Нет staleTime для постов | Средняя | 1 | FeedPage |
| 9 | Blob URL утечка | Средняя | 1 | CreatePostPage |
| 10 | Нет lazy loading | Средняя | 1 | App.tsx |
| 11 | God components | Средняя | 2 | AppShell, CreatePostPage |
| 12 | Hardcode URL | Низкая | 1 | vite.config.ts |
| 13 | Нет Error Boundary | Средняя | - | App.tsx |
| 14 | XSS в markdown href | Средняя | 1 | MarkdownContent |
| 15 | CSS injection banner | Низкая | 2 | ProfilePage, SettingsPage |
| 16 | Нет RLS проверки | Высокая | - | Supabase dashboard |
| 17 | Нет виртуализации | Низкая | - | FeedPage, PostDetailPage |

---

## 11. Приоритет исправлений

### Срочно

1. **RLS в Supabase** — проверить что `DELETE/UPDATE` на `posts` и `comments` требует `auth.uid() = user_id`
2. **XSS в MarkdownContent** — санитизация `href` (`javascript:` протоколы)
3. **Blob URL cleanup** — добавить `useEffect` с `URL.revokeObjectURL` в CreatePostPage

### Важно (улучшит качество)

4. **`useMyProfile()` хук** — устранит дублирование запросов и несовпадение queryKey
5. **`<Avatar />` компонент** — убрать дублирование из 6 мест
6. **Error Boundary** — предотвратит белый экран при любой JS ошибке
7. **`staleTime` для FeedPage** — уменьшит лишние запросы
8. **Scroll throttle через rAF** — улучшит плавность при скролле

### Рефакторинг (можно постепенно)

9. **Lazy loading страниц** — сократит начальный bundle на ~30%
10. **Удалить `icons.tsx` / `cn.ts`** — уборка мёртвого кода
11. **Разбить AppShell и CreatePostPage** — улучшит читаемость
12. **Типы вместо `as unknown`** — `supabase gen types typescript` даст точные типы
13. **Пагинация/виртуализация** — для масштабирования при 100+ постах
14. **Убрать hardcode URL** в `.env`
