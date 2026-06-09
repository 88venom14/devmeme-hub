# Frontend Deploy: GitHub Pages

The frontend is deployed as a static Vite build to GitHub Pages.

## Domain

GitHub Pages serves the app at:

```text
https://fluttershy.horsefucker.ru
```

The build writes `dist/CNAME` automatically with this domain.

## API URL

The frontend must call the Go backend on a separate HTTPS origin. Recommended:

```text
https://api.fluttershy.horsefucker.ru
```

In GitHub repository settings, add an Actions variable:

```text
VITE_API_URL=https://api.fluttershy.horsefucker.ru
```

If this variable is not set, the GitHub Pages workflow uses the same value as a fallback.

## Deploy

Push to `main` or run the `Deploy to GitHub Pages` workflow manually.

The workflow runs:

```text
npm ci
npm run build
```

`npm run build` also prepares GitHub Pages files:

- `dist/CNAME`
- `dist/404.html` for React Router fallback

## Backend CORS

On the VPS backend, include the frontend domain in `ALLOWED_ORIGINS`:

```text
ALLOWED_ORIGINS=https://fluttershy.horsefucker.ru
```

For local development, keep:

```text
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```
