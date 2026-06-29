import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// Phaser 3 + Vite. `base: './'` keeps asset paths relative so the production
// build works from any sub-path or when served as static files.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    open: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
})
