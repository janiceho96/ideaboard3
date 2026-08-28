import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(process.cwd(), 'index.html'),
        ideaboard: resolve(process.cwd(), 'ideaboard.html'),
      },
    },
  },
  test: {
    environment: 'node',
  },
})
