import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    // Two pages: the factory and «Роботтар әлемі».
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), robots: resolve(import.meta.dirname, 'robots.html') } },
  },
  server: { host: true },
});
