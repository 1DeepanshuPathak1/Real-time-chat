import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Real-time-chat/',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
