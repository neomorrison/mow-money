import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' keeps every asset URL relative, so the same build works at
// neomorrison.github.io/mow-money/ and on a local preview server.
export default defineConfig(({ command }) => ({
  base: './',
  server: { port: 5178, strictPort: false },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
    },
  },
  test: undefined,
}));
