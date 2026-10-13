import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
});
