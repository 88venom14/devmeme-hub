import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    // Opt-in bundle analysis: `ANALYZE=1 npm run build` writes bundle-stats.html
    // (gzip + brotli sizes) to the project root. Off by default so it never
    // lands in dist/ or affects the gh-pages deploy.
    ...(process.env.ANALYZE
      ? [visualizer({ filename: 'bundle-stats.html', gzipSize: true, brotliSize: true })]
      : []),
  ],
  server: {
    watch: {
      usePolling: true,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        // Split heavy third-party code out of the entry bundle for better
        // caching. App code (incl. lib/api with the baked-in VITE_API_URL) stays
        // in index.js — the deploy gate greps dist/assets/index.js for the API URL.
        // The markdown stack (react-markdown + highlight.js) is only pulled in by
        // the lazily-loaded MarkdownContent, so its chunk loads on demand.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-highlight'],
        },
      },
    },
  },
});
