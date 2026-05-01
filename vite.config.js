import { defineConfig } from 'vite';

// Pumpernickel Tycoon — Vite config.
// Caddy serves dist/ at /pumpernickel/, so the built asset paths must be
// rooted at that subpath rather than the default '/'.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
});
